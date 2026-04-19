import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import Decimal from 'decimal.js';
import { AddressClusterService } from './address-cluster.service';

// ── Interfaces ────────────────────────────────────────────────────────

export interface WalletMetrics {
  address: string;
  /** 30-day realized PnL in SOL */
  pnl30d: number;
  /** 30-day win rate (0-1) */
  winRate30d: number;
  /** Average holding time in seconds */
  avgHoldTime: number;
  /** Number of trades in last 30 days */
  tradeCount30d: number;
  /** Average position size in SOL (30-day) */
  avgPositionSize: number;
  /** Average position size in SOL (7-day, for probe buy detection — captures style drift) */
  recentAvgPositionSize?: number;
  /** Maximum drawdown (0-1) */
  maxDrawdown: number;
  /** Times participated in rug pulls */
  rugPullCount: number;
  /** Times seen in bundle transactions (potential dev) */
  bundleCount: number;
  /** Ratio of tokens traded that failed security checks (0-1, optional) */
  unsafeTokenRatio?: number;
}

/**
 * Trading style sub-classification for high-tier wallets.
 * - sniper: avg hold <5min, high frequency, profits from early entry
 * - narrative: avg hold 5min~6h, catches momentum/narrative plays
 * - diamond: avg hold >6h, high conviction holds
 */
export type TradingStyle = 'sniper' | 'narrative' | 'diamond';

export interface WalletScore {
  address: string;
  metrics: WalletMetrics;
  /** Composite score 0-100 */
  compositeScore: number;
  /** Tier: S(85+), A(70-84), B(50-69), C(<50) */
  tier: 'S' | 'A' | 'B' | 'C';
  /** Trading style sub-type (only meaningful for S/A tier) */
  tradingStyle: TradingStyle;
  /** Last scored timestamp (epoch ms) */
  lastScoredMs: number;
  /** Consecutive days below removal threshold */
  lowScoreDays: number;
}

export type WalletTier = 'S' | 'A' | 'B' | 'C';

/** Weight multipliers for consensus voting */
export const TIER_WEIGHTS: Record<WalletTier, number> = {
  S: 3,
  A: 2,
  B: 1,
  C: 0,
};

const SCORE_CACHE_PREFIX = (env: string) =>
  `${env}:DEXAUTO:WALLET_SCORER:`;
const SCORE_TTL_SECS = 86400 * 30; // 30 days
const MAX_MONITORED_ADDRESSES = 500;
const REMOVAL_THRESHOLD = 20;
const REMOVAL_DAYS = 7;
const DOWNGRADE_THRESHOLD = 30;

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class WalletScorerService implements OnModuleInit {
  private readonly logger = new Logger(WalletScorerService.name);
  private readonly cachePrefix: string;
  private scores = new Map<string, WalletScore>();
  /** Callback fired immediately when a wallet is demoted to C tier (for real-time removal) */
  private onDemotedCallbacks: Array<(address: string) => void> = [];

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    @Optional() private readonly addressClusterService?: AddressClusterService,
  ) {
    this.cachePrefix = SCORE_CACHE_PREFIX(
      this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase(),
    );
  }

  registerOnDemotedCallback(cb: (address: string) => void): void {
    this.onDemotedCallbacks.push(cb);
  }

  /**
   * Count unique entities from a set of addresses, after Sybil cluster deduplication.
   * Addresses belonging to the same cluster (shared funding source) count as 1 entity.
   */
  countUniqueEntities(addresses: string[]): number {
    if (!this.addressClusterService) return new Set(addresses).size;
    const entities = new Set(
      addresses.map(addr => this.addressClusterService!.getEntity(addr)),
    );
    return entities.size;
  }

  async onModuleInit(): Promise<void> {
    await this.loadScoresFromCache();
    this.logger.log(`Loaded ${this.scores.size} wallet scores from cache`);
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Get the score for a specific wallet address.
   */
  getScore(address: string): WalletScore | undefined {
    return this.scores.get(address);
  }

  /**
   * Get the tier for a wallet. Returns 'C' if unknown.
   */
  getTier(address: string): WalletTier {
    return this.scores.get(address)?.tier ?? 'C';
  }

  /**
   * Get consensus weight for a wallet address.
   */
  getWeight(address: string): number {
    const tier = this.getTier(address);
    return TIER_WEIGHTS[tier];
  }

  /**
   * Get all scores as a map for fast lookup.
   */
  getAllScores(): Map<string, WalletScore> {
    return this.scores;
  }

  /**
   * Get addresses by tier.
   */
  getAddressesByTier(tier: WalletTier): string[] {
    return Array.from(this.scores.entries())
      .filter(([, s]) => s.tier === tier)
      .map(([addr]) => addr);
  }

  /**
   * Get decision-layer addresses (S + A tier only) for consensus.
   */
  getDecisionLayerAddresses(): string[] {
    return Array.from(this.scores.entries())
      .filter(([, s]) => s.tier === 'S' || s.tier === 'A')
      .map(([addr]) => addr);
  }

  /**
   * Calculate weighted consensus score for a set of trader addresses.
   */
  calculateWeightedConsensus(traderAddresses: string[]): number {
    let weightedCount = 0;
    const seen = new Set<string>();

    for (const addr of traderAddresses) {
      if (seen.has(addr)) continue;
      seen.add(addr);
      weightedCount += this.getWeight(addr);
    }

    return weightedCount;
  }

  /**
   * Check if a set of traders meets minimum quality threshold.
   * Requires at least 1 S-tier OR 3+ A-tier addresses.
   */
  meetsMinimumQuality(traderAddresses: string[]): boolean {
    let sCount = 0;
    let aCount = 0;
    const seen = new Set<string>();

    for (const addr of traderAddresses) {
      if (seen.has(addr)) continue;
      seen.add(addr);
      const tier = this.getTier(addr);
      if (tier === 'S') sCount++;
      if (tier === 'A') aCount++;
    }

    return sCount >= 1 || aCount >= 3;
  }

  /**
   * Score a wallet from raw metrics and persist.
   */
  async scoreWallet(metrics: WalletMetrics): Promise<WalletScore> {
    const compositeScore = this.calculateScore(metrics);
    const tier = this.assignTier(compositeScore);
    const tradingStyle = this.classifyTradingStyle(metrics);

    const existing = this.scores.get(metrics.address);
    const lowScoreDays =
      compositeScore < REMOVAL_THRESHOLD
        ? (existing?.lowScoreDays ?? 0) + 1
        : 0;

    const score: WalletScore = {
      address: metrics.address,
      metrics,
      compositeScore,
      tier,
      tradingStyle,
      lastScoredMs: Date.now(),
      lowScoreDays,
    };

    this.scores.set(metrics.address, score);
    await this.persistScore(score);

    // Fire real-time demotion callbacks when a wallet drops to C tier
    const previousTier = existing?.tier;
    if (tier === 'C' && previousTier && previousTier !== 'C') {
      this.logger.warn(
        `Wallet ${metrics.address.slice(0, 8)}... demoted ${previousTier} → C, notifying executors`,
      );
      for (const cb of this.onDemotedCallbacks) {
        try { cb(metrics.address); } catch {}
      }
    }

    return score;
  }

  /**
   * Classify wallet into trading style based on behavioral patterns.
   * - sniper: avg hold <300s (5min), high-frequency scalper
   * - narrative: avg hold 300s~21600s (5min~6h), catches momentum plays
   * - diamond: avg hold >21600s (6h+), high-conviction holder
   */
  private classifyTradingStyle(m: WalletMetrics): TradingStyle {
    if (m.avgHoldTime < 300) return 'sniper';
    if (m.avgHoldTime <= 21600) return 'narrative';
    return 'diamond';
  }

  /**
   * Get addresses by trading style (S + A tier only).
   */
  getAddressesByStyle(style: TradingStyle): string[] {
    return Array.from(this.scores.entries())
      .filter(([, s]) => (s.tier === 'S' || s.tier === 'A') && s.tradingStyle === style)
      .map(([addr]) => addr);
  }

  /**
   * Batch score multiple wallets from metrics data.
   * Typically called from a ClickHouse analytics query.
   */
  async batchScoreWallets(metricsArray: WalletMetrics[]): Promise<WalletScore[]> {
    const results: WalletScore[] = [];
    for (const metrics of metricsArray) {
      const score = await this.scoreWallet(metrics);
      results.push(score);
    }

    // Auto-removal of consistently low-scoring wallets
    this.pruneRemovableWallets();

    // Enforce max address limit
    this.enforceAddressLimit();

    this.logTierDistribution();
    return results;
  }

  /**
   * Manually add a wallet with a default B-tier score.
   * Useful for user-added KOL addresses.
   */
  async addManualWallet(address: string, name?: string): Promise<WalletScore> {
    const defaultMetrics: WalletMetrics = {
      address,
      pnl30d: 0,
      winRate30d: 0.5,
      avgHoldTime: 300,
      tradeCount30d: 10,
      avgPositionSize: 1,
      maxDrawdown: 0.3,
      rugPullCount: 0,
      bundleCount: 0,
    };

    // Give a mid-range B-tier score so they can participate
    const score: WalletScore = {
      address,
      metrics: defaultMetrics,
      compositeScore: 60,
      tier: 'B',
      tradingStyle: 'narrative',
      lastScoredMs: Date.now(),
      lowScoreDays: 0,
    };

    this.scores.set(address, score);
    await this.persistScore(score);

    this.logger.log(`Manually added wallet ${address.slice(0, 8)}... as B-tier`);
    return score;
  }

  // ── Scoring Algorithm ───────────────────────────────────────────────

  /**
   * Core scoring formula. Returns 0-100.
   *
   * Weights:
   * - PnL (25%): Realized profit — negative PnL actively penalizes
   * - Win rate (20%): Consistency matters
   * - Activity (10%): Need enough data points
   * - Hold time (10%): Reward appropriate hold times
   * - Safety (20%): Penalize rug pull / bundle participation
   * - Token quality (15%): Penalize wallets that frequently trade unsafe tokens
   */
  private calculateScore(m: WalletMetrics): number {
    // PnL score: -12 to +25 points.
    let pnlScore: number;
    if (m.pnl30d >= 0) {
      pnlScore = Math.min(m.pnl30d / 100, 1) * 25;
    } else {
      pnlScore = Math.max(m.pnl30d / 50, -1) * 12;
    }

    // Win rate score: 20 points max. Below 40% win rate → 0 points.
    const adjustedWinRate = Math.max(0, (m.winRate30d - 0.4) / 0.6);
    const winRateScore = adjustedWinRate * 20;

    // Activity/consistency score: 10 points. Caps at 50 trades.
    const consistencyScore =
      Math.max(0, Math.min(m.tradeCount30d / 50, 1)) * 10;

    // Hold time score: 10 points. Reward 30s-1h range (meme optimal).
    const holdTimeScore = this.getHoldTimeScore(m.avgHoldTime) * 10;

    // Safety score: 20 points. Deduct for rug pulls and bundle activity.
    const rugPenalty = Math.min(m.rugPullCount / 5, 1);
    const bundlePenalty = Math.min(m.bundleCount / 10, 0.5);
    const safetyScore = Math.max(0, 1 - rugPenalty - bundlePenalty) * 20;

    // Token quality score: 15 points. Penalize wallets trading unsafe tokens.
    // unsafeTokenRatio = 0 → full 15 points; ratio = 1 → 0 points
    const unsafeRatio = m.unsafeTokenRatio ?? 0;
    const tokenQualityScore = Math.max(0, 1 - unsafeRatio) * 15;

    const total =
      pnlScore + winRateScore + consistencyScore + holdTimeScore + safetyScore + tokenQualityScore;

    return Math.max(0, Math.min(100, Math.round(total * 10) / 10));
  }

  /**
   * Hold time scoring curve.
   * Optimal for meme coins: 30s to 1 hour.
   * Too short (<10s) = likely bot/front-runner, penalize.
   * Too long (>24h) = not a scalper, lower signal quality for memes.
   */
  private getHoldTimeScore(avgHoldSecs: number): number {
    if (avgHoldSecs < 10) return 0.2; // Likely bot
    if (avgHoldSecs < 30) return 0.5;
    if (avgHoldSecs <= 3600) return 1.0; // Sweet spot: 30s - 1h
    if (avgHoldSecs <= 86400) return 0.7; // 1h - 24h: still okay
    return 0.3; // > 24h: not ideal for meme trading
  }

  private assignTier(score: number): WalletTier {
    if (score >= 85) return 'S';
    if (score >= 70) return 'A';
    if (score >= 50) return 'B';
    return 'C';
  }

  // ── Maintenance ─────────────────────────────────────────────────────

  /**
   * Run daily at 3 AM UTC to re-score stale wallets and prune low scorers.
   * Wallets not re-scored in 48h+ get their lowScoreDays incremented;
   * recently re-scored wallets (via discovery or import) are skipped.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailyMaintenance(): Promise<void> {
    this.logger.log('Starting daily wallet scorer maintenance...');

    const now = Date.now();
    const staleThresholdMs = 48 * 3600_000; // 48 hours
    let staleCount = 0;
    let downgradedCount = 0;

    for (const [addr, score] of this.scores) {
      // If recently scored by discovery/import pipeline, trust that score
      if (now - score.lastScoredMs < staleThresholdMs) {
        continue;
      }

      staleCount++;

      // Stale + below threshold → degrade
      if (score.compositeScore < DOWNGRADE_THRESHOLD) {
        score.tier = 'C';
        score.lowScoreDays++;
        downgradedCount++;
        await this.persistScore(score);
      } else if (score.compositeScore < DOWNGRADE_THRESHOLD + 20) {
        // Marginally above threshold but stale → increment warning counter
        score.lowScoreDays++;
        await this.persistScore(score);
      }
    }

    this.pruneRemovableWallets();
    this.enforceAddressLimit();
    this.logTierDistribution();
    this.logger.log(
      `Daily maintenance complete: ${staleCount} stale, ${downgradedCount} downgraded`,
    );
  }

  /**
   * Remove wallets that have been below REMOVAL_THRESHOLD for REMOVAL_DAYS.
   */
  private pruneRemovableWallets(): void {
    const toRemove: string[] = [];
    for (const [addr, score] of this.scores) {
      if (score.lowScoreDays >= REMOVAL_DAYS) {
        toRemove.push(addr);
      }
    }

    for (const addr of toRemove) {
      this.scores.delete(addr);
      this.redisClient
        .del(this.scoreKey(addr))
        .catch((err) => this.logger.warn(`redis del failed for ${addr}: ${err?.message ?? err}`));
      this.logger.warn(
        `Removed wallet ${addr.slice(0, 8)}... (low score ${REMOVAL_DAYS}+ days)`,
      );
    }
  }

  /**
   * Enforce maximum address limit by removing lowest-scoring C-tier.
   */
  private enforceAddressLimit(): void {
    if (this.scores.size <= MAX_MONITORED_ADDRESSES) return;

    const sorted = Array.from(this.scores.entries())
      .sort((a, b) => a[1].compositeScore - b[1].compositeScore);

    while (this.scores.size > MAX_MONITORED_ADDRESSES && sorted.length > 0) {
      const [addr] = sorted.shift()!;
      this.scores.delete(addr);
      this.redisClient
        .del(this.scoreKey(addr))
        .catch((err) => this.logger.warn(`redis del failed for ${addr}: ${err?.message ?? err}`));
    }

    this.logger.log(
      `Enforced address limit: ${this.scores.size}/${MAX_MONITORED_ADDRESSES}`,
    );
  }

  private logTierDistribution(): void {
    const dist = { S: 0, A: 0, B: 0, C: 0 };
    for (const score of this.scores.values()) {
      dist[score.tier]++;
    }
    this.logger.log(
      `Wallet tiers: S=${dist.S} A=${dist.A} B=${dist.B} C=${dist.C} total=${this.scores.size}`,
    );
  }

  // ── Redis Persistence ───────────────────────────────────────────────

  private async persistScore(score: WalletScore): Promise<void> {
    const key = this.scoreKey(score.address);
    await this.redisClient.setex(key, SCORE_TTL_SECS, JSON.stringify(score));
  }

  private async loadScoresFromCache(): Promise<void> {
    const pattern = `${this.cachePrefix}*`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await this.redisClient.get(key);
        if (!raw) continue;
        try {
          const score: WalletScore = JSON.parse(raw);
          this.scores.set(score.address, score);
        } catch {
          // Skip malformed entries
        }
      }
    } while (cursor !== '0');
  }

  private scoreKey(address: string): string {
    return `${this.cachePrefix}${address}`;
  }
}
