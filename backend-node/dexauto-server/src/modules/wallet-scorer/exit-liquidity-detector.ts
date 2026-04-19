import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { WalletScorerService, WalletScore } from './wallet-scorer.service';

// ── Interfaces ────────────────────────────────────────────────────────

export interface WalletBehaviorProfile {
  address: string;
  /** How many known bots / copy-traders follow this wallet */
  followedByBotCount: number;
  /** Average price impact (%) after this wallet buys (pumped by followers) */
  avgPriceImpactOnBuy: number;
  /** Average seconds from price peak to this wallet selling */
  avgTimeToSellAfterPump: number;
  /** Times this wallet sold while followers were buying */
  sellWhenFollowersBuyCount: number;
  /** Total sell count for ratio calculation */
  totalSellCount: number;
  /** Estimated profit (SOL) from followers providing exit liquidity */
  profitFromFollowers: number;
  /** Average hold time on profitable trades (seconds) */
  avgHoldTimeOnProfitableTrades: number;
  /** Win rate (0-1) */
  winRate: number;
}

export interface ExitLiquidityResult {
  address: string;
  isLikelyFarmer: boolean;
  score: number;
  reasons: string[];
}

// ── Constants ─────────────────────────────────────────────────────────

const BEHAVIOR_CACHE_PREFIX = (env: string) =>
  `${env}:DEXAUTO:EXIT_LIQ:`;
const BEHAVIOR_TTL_SECS = 86400 * 7;

/** Threshold above which a wallet is flagged as exit-liquidity farmer */
const FARMER_SCORE_THRESHOLD = 0.6;

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class ExitLiquidityDetectorService {
  private readonly logger = new Logger(ExitLiquidityDetectorService.name);
  private readonly cachePrefix: string;

  /** Flagged farmers: address → ExitLiquidityResult */
  private flaggedFarmers = new Map<string, ExitLiquidityResult>();

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly walletScorerService: WalletScorerService,
  ) {
    const env = process.env.NODE_ENV?.toUpperCase() ?? 'DEV';
    this.cachePrefix = BEHAVIOR_CACHE_PREFIX(env);
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Check if a wallet is a suspected exit-liquidity farmer.
   */
  isFarmer(address: string): boolean {
    return this.flaggedFarmers.has(address);
  }

  /**
   * Get detection result for a specific address.
   */
  getResult(address: string): ExitLiquidityResult | undefined {
    return this.flaggedFarmers.get(address);
  }

  /**
   * Analyze a wallet's behavior profile and determine if it's farming exit liquidity.
   *
   * Detection patterns:
   * 1. Quick dump after followers buy in (short hold time + high win rate + high price impact)
   * 2. Sells coincide with follower buys (sell timing overlaps with copy-trade buys)
   * 3. Abnormally high PnL that correlates with follower activity
   */
  async analyzeWallet(profile: WalletBehaviorProfile): Promise<ExitLiquidityResult> {
    let score = 0;
    const reasons: string[] = [];

    // Pattern 1: Quick dump after pump
    // Profitable trades held < 10 minutes + win rate > 70% + average price impact > 5%
    // This means: they buy → followers pump it → they sell quickly
    if (
      profile.avgHoldTimeOnProfitableTrades < 600 &&
      profile.winRate > 0.7 &&
      profile.avgPriceImpactOnBuy > 5
    ) {
      score += 0.4;
      reasons.push(
        `Quick dump pattern: avg hold ${profile.avgHoldTimeOnProfitableTrades}s on wins, ` +
        `win rate ${(profile.winRate * 100).toFixed(0)}%, avg impact ${profile.avgPriceImpactOnBuy.toFixed(1)}%`,
      );
    }

    // Pattern 2: Sells when followers buy
    // If > 50% of their sells happen while followers are buying → exit liquidity farming
    if (profile.totalSellCount > 5) {
      const sellOverlapRatio = profile.sellWhenFollowersBuyCount / profile.totalSellCount;
      if (sellOverlapRatio > 0.5) {
        score += 0.35;
        reasons.push(
          `Sell-during-follow pattern: ${(sellOverlapRatio * 100).toFixed(0)}% of sells overlap with follower buys`,
        );
      } else if (sellOverlapRatio > 0.3) {
        score += 0.15;
        reasons.push(
          `Moderate sell-during-follow: ${(sellOverlapRatio * 100).toFixed(0)}% overlap`,
        );
      }
    }

    // Pattern 3: High profit from followers
    // If estimated profit from follower exit-liquidity > 10 SOL
    if (profile.profitFromFollowers > 10) {
      score += 0.25;
      reasons.push(
        `High follower-sourced profit: ${profile.profitFromFollowers.toFixed(1)} SOL`,
      );
    } else if (profile.profitFromFollowers > 3) {
      score += 0.1;
      reasons.push(
        `Moderate follower-sourced profit: ${profile.profitFromFollowers.toFixed(1)} SOL`,
      );
    }

    // Pattern 4: Many bots following
    // If > 20 known bots follow this wallet, it's a common exit-liquidity target
    if (profile.followedByBotCount > 20) {
      score += 0.15;
      reasons.push(
        `High bot following: ${profile.followedByBotCount} known bots`,
      );
    }

    // Pattern 5: Very fast sell after pump peak
    // If they consistently sell within 30 seconds of the price peak
    if (profile.avgTimeToSellAfterPump < 30 && profile.avgTimeToSellAfterPump > 0) {
      score += 0.2;
      reasons.push(
        `Ultra-fast sell after pump: avg ${profile.avgTimeToSellAfterPump.toFixed(0)}s after peak`,
      );
    }

    score = Math.min(score, 1.0);
    const isLikelyFarmer = score >= FARMER_SCORE_THRESHOLD;

    const result: ExitLiquidityResult = {
      address: profile.address,
      isLikelyFarmer,
      score,
      reasons,
    };

    // Cache result
    await this.redisClient.setex(
      `${this.cachePrefix}${profile.address}`,
      BEHAVIOR_TTL_SECS,
      JSON.stringify(result),
    );

    // Update in-memory map
    if (isLikelyFarmer) {
      this.flaggedFarmers.set(profile.address, result);
      this.logger.warn(
        `Flagged exit-liquidity farmer: ${profile.address.slice(0, 8)}... ` +
        `(score=${score.toFixed(2)}, reasons=${reasons.length})`,
      );

      // Auto-downgrade to C tier in wallet scorer
      const currentScore = this.walletScorerService.getScore(profile.address);
      if (currentScore && currentScore.tier !== 'C') {
        this.logger.warn(
          `Downgrading ${profile.address.slice(0, 8)}... from ${currentScore.tier} to C tier ` +
          `due to exit-liquidity farming detection`,
        );
        // Re-score with severe penalty by modifying metrics
        const penalizedMetrics = {
          ...currentScore.metrics,
          rugPullCount: Math.max(currentScore.metrics.rugPullCount, 10),
        };
        await this.walletScorerService.scoreWallet(penalizedMetrics);
      }
    } else {
      this.flaggedFarmers.delete(profile.address);
    }

    return result;
  }

  /**
   * Batch analyze multiple wallet profiles.
   * Typically called with data aggregated from ClickHouse.
   */
  async batchAnalyze(profiles: WalletBehaviorProfile[]): Promise<ExitLiquidityResult[]> {
    const results: ExitLiquidityResult[] = [];
    for (const profile of profiles) {
      const result = await this.analyzeWallet(profile);
      results.push(result);
    }

    const farmerCount = results.filter((r) => r.isLikelyFarmer).length;
    this.logger.log(
      `Batch exit-liquidity analysis: ${profiles.length} wallets, ${farmerCount} farmers detected`,
    );

    return results;
  }

  /**
   * Weekly review of all S/A tier addresses for exit-liquidity farming behavior.
   * Called from daily maintenance or manually.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async weeklyReview(): Promise<void> {
    this.logger.log('Starting weekly exit-liquidity review of S/A tier wallets...');

    const scores = this.walletScorerService.getAllScores();
    const highTierAddresses: string[] = [];

    for (const [addr, score] of scores) {
      if (score.tier === 'S' || score.tier === 'A') {
        highTierAddresses.push(addr);
      }
    }

    this.logger.log(
      `Reviewing ${highTierAddresses.length} S/A tier wallets for exit-liquidity patterns`,
    );

    // In production, this would fetch behavior profiles from ClickHouse
    // For now, load cached results
    for (const addr of highTierAddresses) {
      const cached = await this.redisClient.get(`${this.cachePrefix}${addr}`);
      if (cached) {
        try {
          const result: ExitLiquidityResult = JSON.parse(cached);
          if (result.isLikelyFarmer) {
            this.flaggedFarmers.set(addr, result);
          }
        } catch {
          // Skip malformed
        }
      }
    }

    this.logger.log(
      `Weekly review complete. ${this.flaggedFarmers.size} total flagged farmers.`,
    );
  }

  /**
   * Load cached farmer flags on startup.
   */
  async loadFromCache(): Promise<void> {
    const pattern = `${this.cachePrefix}*`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redisClient.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await this.redisClient.get(key);
        if (!raw) continue;
        try {
          const result: ExitLiquidityResult = JSON.parse(raw);
          if (result.isLikelyFarmer) {
            this.flaggedFarmers.set(result.address, result);
          }
        } catch {
          // Skip
        }
      }
    } while (cursor !== '0');

    this.logger.log(`Loaded ${this.flaggedFarmers.size} flagged farmers from cache`);
  }
}
