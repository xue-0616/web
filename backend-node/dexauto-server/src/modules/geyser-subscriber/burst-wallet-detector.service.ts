import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { ParsedDexSwap } from './parsers/dex-swap-parser';
import {
  SmartWalletSourceService,
  ImportWalletCandidateInput,
} from '../smart-wallet-source/smart-wallet-source.service';

/**
 * Tracks an unknown address's recent trading performance in real-time.
 * When a non-monitored address accumulates enough profitable trades
 * within a short window, it gets immediately imported as a candidate
 * instead of waiting for the next 6h discovery cycle.
 *
 * Anti-Sybil measures:
 *   - Higher thresholds ($2000 profit, 5 trades, 60% win rate)
 *   - Must trade at least 2 distinct tokens (single-token wash is easy to fake)
 *   - Funding source clustering: skip addresses funded by the same parent wallet
 *     as recently flagged Sybil addresses
 */
interface BurstTracker {
  address: string;
  firstSeenMs: number;
  lastSeenMs: number;
  trades: Array<{ usdValue: number; side: 'buy' | 'sell'; tokenMint: string; timestampMs: number }>;
  totalBuyUsd: number;
  totalSellUsd: number;
  uniqueTokens: Set<string>;
  triggered: boolean;
}

// Hardened thresholds (anti-Sybil)
const BURST_WINDOW_MS = 30 * 60 * 1000;  // 30 min sliding window
const MIN_TRADES_IN_WINDOW = 5;           // at least 5 trades (was 3)
const MIN_PROFIT_USD = 2000;              // at least $2000 net profit (was $500)
const MIN_WIN_RATE = 0.6;                 // at least 60% profitable sells (was 50%)
const MIN_UNIQUE_TOKENS = 2;              // must trade 2+ different tokens
const MIN_SELL_TRADES = 2;                // must have at least 2 sell trades
const MAX_TRACKED_ADDRESSES = 5000;       // memory cap for tracking
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 4 * 3600 * 1000;

// Sybil cluster tracking: addresses funded by the same parent within 1h
const SYBIL_CLUSTER_WINDOW_MS = 60 * 60 * 1000;
const SYBIL_CLUSTER_THRESHOLD = 3; // 3+ burst addresses from same parent = cluster

@Injectable()
export class BurstWalletDetectorService {
  private readonly logger = new Logger(BurstWalletDetectorService.name);
  private trackers = new Map<string, BurstTracker>();
  private triggeredCooldown = new Map<string, number>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Sybil cluster tracking: maps "first SOL transfer source" → set of burst-triggered addresses.
   * If the same funding source spawns 3+ burst wallets within 1h, all are blocked.
   */
  private fundingSourceClusters = new Map<string, { addresses: Set<string>; firstSeenMs: number }>();
  private blockedFundingSources = new Set<string>();

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @Optional()
    private readonly smartWalletSourceService?: SmartWalletSourceService,
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Called for EVERY swap detected by GeyserSubscriber, including
   * swaps from non-monitored addresses. This is the hot path.
   *
   * We only track non-monitored addresses (unknown wallets).
   * Monitored addresses are already in our system — no need to detect them.
   */
  onSwapDetected(swap: ParsedDexSwap, isMonitoredAddress: boolean): void {
    if (isMonitoredAddress) return;

    const address = swap.trader;
    if (!address) return;

    // Check cooldown — don't re-detect recently triggered addresses
    const lastTriggered = this.triggeredCooldown.get(address);
    if (lastTriggered && Date.now() - lastTriggered < COOLDOWN_MS) return;

    const now = Date.now();
    let tracker = this.trackers.get(address);

    if (!tracker) {
      // Memory cap: evict oldest tracker if at limit
      if (this.trackers.size >= MAX_TRACKED_ADDRESSES) {
        this.evictOldest();
      }
      tracker = {
        address,
        firstSeenMs: now,
        lastSeenMs: now,
        trades: [],
        totalBuyUsd: 0,
        totalSellUsd: 0,
        uniqueTokens: new Set(),
        triggered: false,
      };
      this.trackers.set(address, tracker);
    }

    tracker.lastSeenMs = now;
    const usdValue = Math.abs(parseFloat(swap.usd_value) || 0);

    tracker.trades.push({
      usdValue,
      side: swap.side,
      tokenMint: swap.base_mint,
      timestampMs: now,
    });

    if (swap.side === 'buy') {
      tracker.totalBuyUsd += usdValue;
    } else {
      tracker.totalSellUsd += usdValue;
    }
    tracker.uniqueTokens.add(swap.base_mint);

    // Prune trades outside the sliding window
    this.pruneWindow(tracker);

    // Check if this address qualifies for burst import
    if (!tracker.triggered) {
      this.evaluateBurst(tracker);
    }
  }

  private pruneWindow(tracker: BurstTracker): void {
    const cutoff = Date.now() - BURST_WINDOW_MS;
    const before = tracker.trades.length;
    tracker.trades = tracker.trades.filter((t) => t.timestampMs >= cutoff);

    if (tracker.trades.length < before) {
      // Recalculate totals from remaining trades
      tracker.totalBuyUsd = 0;
      tracker.totalSellUsd = 0;
      tracker.uniqueTokens = new Set();
      for (const t of tracker.trades) {
        if (t.side === 'buy') tracker.totalBuyUsd += t.usdValue;
        else tracker.totalSellUsd += t.usdValue;
        tracker.uniqueTokens.add(t.tokenMint);
      }
    }
  }

  private evaluateBurst(tracker: BurstTracker): void {
    const windowTrades = tracker.trades;
    if (windowTrades.length < MIN_TRADES_IN_WINDOW) return;

    // Must trade at least 2 different tokens (single-token wash is trivial to fake)
    if (tracker.uniqueTokens.size < MIN_UNIQUE_TOKENS) return;

    // Calculate net profit (sells - buys) within window
    const netProfit = tracker.totalSellUsd - tracker.totalBuyUsd;
    if (netProfit < MIN_PROFIT_USD) return;

    // Need at least MIN_SELL_TRADES sell trades for statistical significance
    const sells = windowTrades.filter((t) => t.side === 'sell');
    if (sells.length < MIN_SELL_TRADES) return;

    // Compute per-token realized PnL to measure real win rate.
    // A token is a "win" if totalSellUsd > totalBuyUsd for that token within the window.
    // (usdValue is Math.abs()'d on ingest, so we can't compare raw trade signs.)
    const profitByToken = new Map<string, number>();
    for (const t of windowTrades) {
      const prev = profitByToken.get(t.tokenMint) ?? 0;
      profitByToken.set(t.tokenMint, prev + (t.side === 'sell' ? t.usdValue : -t.usdValue));
    }
    // Only count tokens that had at least 1 sell (closed/partially-closed positions).
    const tokensWithSells = new Set(sells.map((s) => s.tokenMint));
    const closedTokens = Array.from(profitByToken.entries())
      .filter(([mint]) => tokensWithSells.has(mint));
    if (closedTokens.length < MIN_UNIQUE_TOKENS) return;

    const profitableTokenCount = closedTokens.filter(([, pnl]) => pnl > 0).length;
    const winRate = profitableTokenCount / closedTokens.length;
    if (winRate < MIN_WIN_RATE) return;

    // Anti-wash: require profit across at least 2 distinct tokens (not just one hot trade)
    if (profitableTokenCount < 2) return;

    // This address is a burst performer — trigger immediate import
    tracker.triggered = true;
    this.triggeredCooldown.set(tracker.address, Date.now());

    this.logger.warn(
      `BURST DETECTED: ${tracker.address.slice(0, 8)}... ` +
      `${windowTrades.length} trades, $${netProfit.toFixed(0)} profit, ` +
      `${(winRate * 100).toFixed(0)}% win rate, ${tracker.uniqueTokens.size} tokens ` +
      `in ${BURST_WINDOW_MS / 60000}min window`,
    );

    this.triggerImport(tracker);
  }

  private async triggerImport(tracker: BurstTracker): Promise<void> {
    if (!this.smartWalletSourceService) {
      this.logger.warn('SmartWalletSourceService not available, skipping burst import');
      return;
    }

    // Anti-Sybil: check if this address's funding source is blocked
    const fundingSource = await this.checkFundingSource(tracker.address);
    if (fundingSource && this.blockedFundingSources.has(fundingSource)) {
      this.logger.warn(
        `SYBIL BLOCKED: ${tracker.address.slice(0, 8)}... funded by blocked source ${fundingSource.slice(0, 8)}...`,
      );
      return;
    }

    // Track funding source cluster
    if (fundingSource) {
      this.trackFundingCluster(fundingSource, tracker.address);
    }

    const windowTrades = tracker.trades;
    const sells = windowTrades.filter((t) => t.side === 'sell');

    // Recompute per-token win rate (same logic as evaluateBurst) for metric reporting.
    const profitByToken = new Map<string, number>();
    for (const t of windowTrades) {
      const prev = profitByToken.get(t.tokenMint) ?? 0;
      profitByToken.set(t.tokenMint, prev + (t.side === 'sell' ? t.usdValue : -t.usdValue));
    }
    const tokensWithSells = new Set(sells.map((s) => s.tokenMint));
    const closedTokens = Array.from(profitByToken.entries())
      .filter(([mint]) => tokensWithSells.has(mint));
    const profitableTokenCount = closedTokens.filter(([, pnl]) => pnl > 0).length;
    const winRateMetric = closedTokens.length > 0
      ? profitableTokenCount / closedTokens.length
      : 0.5;

    const item: ImportWalletCandidateInput = {
      address: tracker.address,
      sourceLabel: 'burst_detection_realtime',
      isSystemMonitored: true,
      metrics: {
        pnl30d: (tracker.totalSellUsd - tracker.totalBuyUsd) / 100,
        winRate30d: winRateMetric,
        avgHoldTime: this.estimateAvgHoldTime(windowTrades),
        tradeCount30d: windowTrades.length,
      },
      rawData: {
        burstDetectedAt: Date.now(),
        burstWindowMs: BURST_WINDOW_MS,
        burstTradeCount: windowTrades.length,
        burstNetProfitUsd: tracker.totalSellUsd - tracker.totalBuyUsd,
        uniqueTokensTraded: tracker.uniqueTokens.size,
        fundingSource: fundingSource ?? 'unknown',
      },
    };

    try {
      const result = await this.smartWalletSourceService.importCandidates(
        'onchain_discovery',
        [item],
      );
      if (result.length > 0) {
        this.logger.log(
          `Burst wallet ${tracker.address.slice(0, 8)}... imported as ${result[0].tier}-tier (score: ${result[0].score})`,
        );
      }
    } catch (err) {
      this.logger.error(`Burst import failed for ${tracker.address.slice(0, 8)}...: ${(err as Error)}`);
    }
  }

  /**
   * Query the earliest SOL transfer source for a given address.
   * Returns the address that first funded this wallet with SOL,
   * used for Sybil cluster detection (same parent → same attacker).
   */
  private async checkFundingSource(address: string): Promise<string | null> {
    try {
      // Check cached result first
      const cacheKey = `BURST_FUNDING:${address}`;
      const cached = await this.redisClient.get(cacheKey);
      if (cached) return cached === 'unknown' ? null : cached;

      // Query Solana for the first SOL transfer into this address
      // Use getSignaturesForAddress with limit=1 + order=asc to get earliest tx
      const response = await fetch(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [address, { limit: 1 }],
          }),
          signal: AbortSignal.timeout(3000),
        },
      );

      const data = await response.json() as any;
      const signatures = data?.result;
      if (!signatures || signatures.length === 0) {
        await this.redisClient.setex(cacheKey, 3600, 'unknown');
        return null;
      }

      // Get the first transaction to find who funded this address
      const txResp = await fetch(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [signatures[0].signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
          }),
          signal: AbortSignal.timeout(3000),
        },
      );

      const txData = await txResp.json() as any;
      const accountKeys = txData?.result?.transaction?.message?.accountKeys;
      if (!accountKeys || accountKeys.length < 2) {
        await this.redisClient.setex(cacheKey, 3600, 'unknown');
        return null;
      }

      // The signer of the first tx that involves this address is likely the funder
      const funder = accountKeys[0]?.pubkey ?? accountKeys[0];
      if (funder && funder !== address) {
        await this.redisClient.setex(cacheKey, 86400, funder); // cache 24h
        return funder;
      }

      await this.redisClient.setex(cacheKey, 3600, 'unknown');
      return null;
    } catch {
      return null; // Don't block import on RPC errors
    }
  }

  /**
   * Track which burst addresses share the same funding source.
   * If 3+ burst addresses are funded by the same parent within 1h,
   * block that funding source (likely Sybil attack).
   */
  private trackFundingCluster(fundingSource: string, burstAddress: string): void {
    let cluster = this.fundingSourceClusters.get(fundingSource);
    const now = Date.now();

    if (!cluster || now - cluster.firstSeenMs > SYBIL_CLUSTER_WINDOW_MS) {
      cluster = { addresses: new Set(), firstSeenMs: now };
      this.fundingSourceClusters.set(fundingSource, cluster);
    }

    cluster.addresses.add(burstAddress);

    if (cluster.addresses.size >= SYBIL_CLUSTER_THRESHOLD) {
      this.blockedFundingSources.add(fundingSource);
      this.logger.error(
        `SYBIL CLUSTER DETECTED: ${fundingSource.slice(0, 8)}... spawned ${cluster.addresses.size} burst wallets. ` +
        `Blocking all future imports from this funding source.`,
      );
    }
  }

  private estimateAvgHoldTime(trades: BurstTracker['trades']): number {
    if (trades.length < 2) return 300;
    // Group by token, estimate hold time as gap between first buy and first sell
    const tokenFirstBuy = new Map<string, number>();
    const tokenFirstSell = new Map<string, number>();

    for (const t of trades) {
      if (t.side === 'buy' && !tokenFirstBuy.has(t.tokenMint)) {
        tokenFirstBuy.set(t.tokenMint, t.timestampMs);
      }
      if (t.side === 'sell' && !tokenFirstSell.has(t.tokenMint)) {
        tokenFirstSell.set(t.tokenMint, t.timestampMs);
      }
    }

    const holdTimes: number[] = [];
    for (const [token, buyTime] of tokenFirstBuy) {
      const sellTime = tokenFirstSell.get(token);
      if (sellTime && sellTime > buyTime) {
        holdTimes.push((sellTime - buyTime) / 1000);
      }
    }

    if (holdTimes.length === 0) return 300;
    return holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, tracker] of this.trackers) {
      if (tracker.lastSeenMs < oldestTime) {
        oldestTime = tracker.lastSeenMs;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.trackers.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - BURST_WINDOW_MS * 2;
    let cleaned = 0;
    for (const [key, tracker] of this.trackers) {
      if (tracker.lastSeenMs < cutoff) {
        this.trackers.delete(key);
        cleaned++;
      }
    }

    // Clean old cooldowns
    const cooldownCutoff = now - COOLDOWN_MS;
    for (const [key, time] of this.triggeredCooldown) {
      if (time < cooldownCutoff) {
        this.triggeredCooldown.delete(key);
      }
    }

    // Clean stale Sybil cluster data (keep blocked sources permanently until restart)
    for (const [key, cluster] of this.fundingSourceClusters) {
      if (now - cluster.firstSeenMs > SYBIL_CLUSTER_WINDOW_MS * 2) {
        this.fundingSourceClusters.delete(key);
      }
    }

    if (cleaned > 0) {
      this.logger.debug(
        `Cleaned ${cleaned} stale burst trackers, ${this.trackers.size} active, ` +
        `${this.blockedFundingSources.size} blocked funding sources`,
      );
    }
  }

  getStats(): { activeTrackers: number; triggeredCount: number; cooldownCount: number } {
    return {
      activeTrackers: this.trackers.size,
      triggeredCount: Array.from(this.trackers.values()).filter((t) => t.triggered).length,
      cooldownCount: this.triggeredCooldown.size,
    };
  }
}
