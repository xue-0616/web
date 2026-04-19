import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Decimal from 'decimal.js';
import { ParsedDexSwap } from './parsers/dex-swap-parser';
import {
  PositionMonitorService,
  TrackedPosition,
} from '../position-monitor/position-monitor.service';
import { WalletScorerService, TradingStyle } from '../wallet-scorer/wallet-scorer.service';
import { KpiDashboardService } from '../wallet-scorer/kpi-dashboard.service';
import { MessageNotifierService } from '../message-notifier/message-notifier.service';

/**
 * Real-time exit liquidity circuit breaker with tiered response.
 *
 * Instead of a binary "sell everything" response, uses graduated sell ratios
 * based on how suspicious the pattern is + the wallet's known trading style.
 *
 * Tiered response (sell ratio):
 *   - Level 1 (< 2min dump):  sell 80% — almost certainly farming exit liquidity
 *   - Level 2 (2-5min dump):  sell 50% — likely farming, but could be fast legit scalp
 *   - Level 3 (5-10min dump): sell 30% — suspicious, reduce exposure as precaution
 *
 * Trading style awareness:
 *   - 'sniper' wallets (avg hold <5min): SKIP Level 3, only trigger on Level 1-2
 *     because fast exits are their normal behavior
 *   - 'narrative' wallets: full tiered response
 *   - 'diamond' wallets: selling within 10min is extremely abnormal → always trigger
 */

// Time thresholds for tiered response
const LEVEL1_MS = 2 * 60 * 1000;   // < 2 minutes = almost certainly farming
const LEVEL2_MS = 5 * 60 * 1000;   // 2-5 minutes = likely farming
const LEVEL3_MS = 10 * 60 * 1000;  // 5-10 minutes = suspicious

// Sell ratios per level (0-1)
const LEVEL1_SELL_RATIO = '0.8';
const LEVEL2_SELL_RATIO = '0.5';
const LEVEL3_SELL_RATIO = '0.3';

// Batch sell configuration — prevent self-inflicted slippage
// Large sells are split into randomized tranches to defeat MEV pattern detection.
// Fixed intervals/ratios are trivially fingerprinted by MEV bots that observe
// account history and predict subsequent tranches. Randomization breaks this.
const BATCH_SELL_MIN_TRANCHES = 2;
const BATCH_SELL_MAX_TRANCHES = 4;
const BATCH_SELL_INTERVAL_MIN_MS = 500;   // minimum 500ms (~1 slot)
const BATCH_SELL_INTERVAL_MAX_MS = 2000;  // maximum 2s (~5 slots)
const BATCH_SELL_RATIO_JITTER = 0.3;      // ±30% jitter on per-tranche ratio
const MAX_SINGLE_TRANCHE_RATIO = 0.35;    // no single tranche exceeds 35% of position

// Strike thresholds for auto-blacklist
const MAX_FAST_DUMP_STRIKES = 3;
const STRIKE_WINDOW_MS = 24 * 3600 * 1000;

const OUR_BUYS_PREFIX = (env: string) =>
  `${env}:DEXAUTO:CIRCUIT_BREAKER:OUR_BUY:`;
const OUR_BUYS_TTL = 15 * 60;
const STRIKES_PREFIX = (env: string) =>
  `${env}:DEXAUTO:CIRCUIT_BREAKER:STRIKES:`;
const STRIKES_TTL = 24 * 3600;

interface OurBuyRecord {
  tokenMint: string;
  sourceWallet: string;
  buyTimestampMs: number;
  orderId?: string;
}

@Injectable()
export class RealtimeExitLiquidityService {
  private readonly logger = new Logger(RealtimeExitLiquidityService.name);
  private readonly buyPrefix: string;
  private readonly strikesPrefix: string;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    private readonly positionMonitorService: PositionMonitorService,
    private readonly walletScorerService: WalletScorerService,
    private readonly kpiDashboard: KpiDashboardService,
    private readonly notifyService: MessageNotifierService,
  ) {
    const env = this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase();
    this.buyPrefix = OUR_BUYS_PREFIX(env);
    this.strikesPrefix = STRIKES_PREFIX(env);
  }

  async onOurBuyExecuted(
    tokenMint: string,
    sourceWallet: string,
    orderId?: string,
  ): Promise<void> {
    const record: OurBuyRecord = {
      tokenMint,
      sourceWallet,
      buyTimestampMs: Date.now(),
      orderId,
    };
    const key = `${this.buyPrefix}${sourceWallet}:${tokenMint}`;
    await this.redisClient.setex(key, OUR_BUYS_TTL, JSON.stringify(record));
  }

  async onSmartMoneySell(swap: ParsedDexSwap): Promise<void> {
    const sourceWallet = swap.trader;
    const tokenMint = swap.base_mint;

    const key = `${this.buyPrefix}${sourceWallet}:${tokenMint}`;
    const raw = await this.redisClient.get(key);
    if (!raw) return;

    let record: OurBuyRecord;
    try {
      record = JSON.parse(raw);
    } catch {
      return;
    }

    const timeSinceBuyMs = Date.now() - record.buyTimestampMs;
    if (timeSinceBuyMs > LEVEL3_MS) return; // Outside all windows — normal trade

    // Determine the wallet's trading style for context-aware response
    const walletScore = this.walletScorerService.getScore(sourceWallet);
    const tradingStyle: TradingStyle = walletScore?.tradingStyle ?? 'narrative';

    // Determine response level
    const response = this.determineResponse(timeSinceBuyMs, tradingStyle);
    if (!response) return; // No action needed (e.g., sniper wallet + Level 3)

    this.logger.error(
      `CIRCUIT BREAKER [${response.level}]: ${sourceWallet.slice(0, 8)}... ` +
      `(style: ${tradingStyle}) sold ${tokenMint.slice(0, 8)}... ` +
      `${(timeSinceBuyMs / 1000).toFixed(0)}s after our copy-buy. ` +
      `Reducing position by ${(parseFloat(response.sellRatio) * 100).toFixed(0)}%`,
    );

    // Record KPI
    this.kpiDashboard.recordRugPullDetected(true);

    // Execute tiered sell
    await this.tieredSellPositions(tokenMint, sourceWallet, response.sellRatio);

    // Only record strikes for Level 1-2 (clear farming behavior)
    if (response.level <= 2) {
      await this.recordStrike(sourceWallet, tokenMint, timeSinceBuyMs);
    }

    await this.redisClient.del(key);
  }

  /**
   * Context-aware response determination.
   * Returns null if no action should be taken.
   */
  private determineResponse(
    timeSinceBuyMs: number,
    tradingStyle: TradingStyle,
  ): { level: number; sellRatio: string } | null {
    if (timeSinceBuyMs < LEVEL1_MS) {
      // < 2 minutes: highly suspicious for ALL styles
      return { level: 1, sellRatio: LEVEL1_SELL_RATIO };
    }

    if (timeSinceBuyMs < LEVEL2_MS) {
      // 2-5 minutes: suspicious for narrative/diamond, still concerning for sniper
      if (tradingStyle === 'sniper') {
        // Snipers normally hold 30s-5min — this could be legit
        // Use a lighter response
        return { level: 2, sellRatio: LEVEL3_SELL_RATIO };
      }
      return { level: 2, sellRatio: LEVEL2_SELL_RATIO };
    }

    // 5-10 minutes
    if (tradingStyle === 'sniper') {
      // 5-10min is NORMAL for snipers — skip entirely
      return null;
    }

    if (tradingStyle === 'diamond') {
      // Diamond wallets normally hold 6h+ — selling in 10min is extremely abnormal
      return { level: 3, sellRatio: LEVEL2_SELL_RATIO };
    }

    // Narrative wallets: 5-10min is on the edge — light precautionary reduction
    return { level: 3, sellRatio: LEVEL3_SELL_RATIO };
  }

  /**
   * Batched tiered sell — splits the target sell ratio across multiple tranches
   * to avoid self-inflicted slippage in thin liquidity pools.
   *
   * Example: 80% sell → 3 tranches of ~27% each, 5 seconds apart.
   * This gives the AMM pool time to rebalance between tranches.
   *
   * For small sell ratios (≤ MAX_SINGLE_TRANCHE_RATIO), executes as single trade.
   */
  private async tieredSellPositions(
    tokenMint: string,
    sourceWallet: string,
    sellRatio: string,
  ): Promise<void> {
    const targetRatio = parseFloat(sellRatio);

    // Find all matching positions first — restricted to those originated by this sourceWallet,
    // so unrelated positions in the same token are not affected.
    const matchingPositions = await this.findMatchingPositions(tokenMint, sourceWallet);
    if (matchingPositions.length === 0) return;

    // For small ratios, execute as single tranche (no slippage risk)
    if (targetRatio <= MAX_SINGLE_TRANCHE_RATIO) {
      await this.executeSellTranche(matchingPositions, targetRatio);
      this.logger.warn(
        `Circuit breaker: single tranche sell ${(targetRatio * 100).toFixed(0)}% ` +
        `on ${matchingPositions.length} position(s) for ${tokenMint.slice(0, 8)}...`,
      );
      return;
    }

    // Split into randomized tranches to defeat MEV pattern detection.
    // Tranche count, per-tranche ratio, and interval are all randomized.
    const minTranches = Math.max(
      BATCH_SELL_MIN_TRANCHES,
      Math.ceil(targetRatio / MAX_SINGLE_TRANCHE_RATIO),
    );
    const trancheCount = Math.min(
      BATCH_SELL_MAX_TRANCHES,
      minTranches + Math.floor(Math.random() * 2), // +0 or +1 random extra
    );

    // Generate randomized per-tranche ratios that sum to targetRatio
    const trancheRatios = this.generateRandomizedTranches(targetRatio, trancheCount);

    this.logger.warn(
      `Circuit breaker: splitting ${(targetRatio * 100).toFixed(0)}% sell into ` +
      `${trancheCount} randomized tranches [${trancheRatios.map(r => (r * 100).toFixed(0) + '%').join(', ')}] ` +
      `for ${tokenMint.slice(0, 8)}...`,
    );

    let cumulativeRatio = 0;
    for (let i = 0; i < trancheCount; i++) {
      cumulativeRatio += trancheRatios[i];
      const trancheRatio = Math.min(cumulativeRatio, targetRatio);

      await this.executeSellTranche(matchingPositions, trancheRatio);

      // Randomized interval between tranches
      const intervalMs = BATCH_SELL_INTERVAL_MIN_MS +
        Math.floor(Math.random() * (BATCH_SELL_INTERVAL_MAX_MS - BATCH_SELL_INTERVAL_MIN_MS));

      this.logger.log(
        `Tranche ${i + 1}/${trancheCount}: cumulative ${(trancheRatio * 100).toFixed(0)}%, ` +
        `next in ${intervalMs}ms`,
      );

      if (i < trancheCount - 1) {
        await this.sleep(intervalMs);
      }
    }
  }

  /**
   * Execute a single sell tranche across all matching positions.
   */
  private async executeSellTranche(
    positions: Array<{ orderId: string; existingRatio: number }>,
    targetRatio: number,
  ): Promise<void> {
    for (const pos of positions) {
      try {
        const effectiveRatio = Math.max(pos.existingRatio, targetRatio);
        await this.positionMonitorService.evaluatePosition(
          pos.orderId,
          '',
          effectiveRatio.toFixed(4),
        );
      } catch (err) {
        this.logger.error(`Tranche sell failed for order ${pos.orderId}: ${(err as Error)}`);
      }
    }
  }

  /**
   * Generate randomized tranche ratios that sum to targetRatio.
   * Each tranche is jittered ±BATCH_SELL_RATIO_JITTER around the mean,
   * then normalized to ensure the exact total. This makes the sell pattern
   * unpredictable to MEV bots observing account transaction history.
   */
  private generateRandomizedTranches(targetRatio: number, count: number): number[] {
    const meanRatio = targetRatio / count;
    const raw: number[] = [];

    for (let i = 0; i < count; i++) {
      // ±30% jitter: multiplier between 0.7 and 1.3
      const jitter = 1 - BATCH_SELL_RATIO_JITTER + Math.random() * BATCH_SELL_RATIO_JITTER * 2;
      raw.push(meanRatio * jitter);
    }

    // Normalize so they sum exactly to targetRatio
    const rawSum = raw.reduce((a, b) => a + b, 0);
    const normalized = raw.map((r) => (r / rawSum) * targetRatio);

    // Clamp each tranche to MAX_SINGLE_TRANCHE_RATIO
    // If any exceeds the cap, redistribute the excess to others
    let excess = 0;
    let uncappedCount = 0;
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] > MAX_SINGLE_TRANCHE_RATIO) {
        excess += normalized[i] - MAX_SINGLE_TRANCHE_RATIO;
        normalized[i] = MAX_SINGLE_TRANCHE_RATIO;
      } else {
        uncappedCount++;
      }
    }
    if (excess > 0 && uncappedCount > 0) {
      const perUncapped = excess / uncappedCount;
      for (let i = 0; i < normalized.length; i++) {
        if (normalized[i] < MAX_SINGLE_TRANCHE_RATIO) {
          normalized[i] += perUncapped;
        }
      }
    }

    return normalized;
  }

  /**
   * Find all tracked positions matching a token mint.
   */
  private async findMatchingPositions(
    tokenMint: string,
    sourceWallet?: string,
  ): Promise<Array<{ orderId: string; existingRatio: number }>> {
    const results: Array<{ orderId: string; existingRatio: number }> = [];

    try {
      const posPrefix = this.configService
        .get<string>('NODE_ENV', 'DEV')
        .toUpperCase();
      const posPattern = `${posPrefix}:DEXAUTO:POSITION_MONITOR:*`;

      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redisClient.scan(
          cursor, 'MATCH', posPattern, 'COUNT', 100,
        );
        cursor = nextCursor;

        for (const key of keys) {
          const raw = await this.redisClient.get(key);
          if (!raw) continue;
          try {
            const pos: TrackedPosition = JSON.parse(raw);
            // Only match positions for this token AND (when specified) originated
            // by the given source wallet — so unrelated positions are untouched.
            const sourceMatches =
              sourceWallet === undefined || pos.sourceWalletAddress === sourceWallet;
            if (pos.tokenMint === tokenMint && sourceMatches) {
              results.push({
                orderId: pos.orderId,
                existingRatio: parseFloat(pos.sourceWalletSellRatio || '0'),
              });
            }
          } catch {
            // Skip malformed
          }
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.error(`Failed to find matching positions: ${(err as Error)}`);
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async recordStrike(
    address: string,
    tokenMint: string,
    dumpTimeMs: number,
  ): Promise<void> {
    const strikeKey = `${this.strikesPrefix}${address}`;
    const count = await this.redisClient.incr(strikeKey);
    await this.redisClient.expire(strikeKey, STRIKES_TTL);

    this.logger.warn(
      `Strike ${count}/${MAX_FAST_DUMP_STRIKES} for ${address.slice(0, 8)}... ` +
      `(dumped ${tokenMint.slice(0, 8)}... in ${(dumpTimeMs / 1000).toFixed(0)}s)`,
    );

    if (count >= MAX_FAST_DUMP_STRIKES) {
      const currentScore = this.walletScorerService.getScore(address);
      if (currentScore && currentScore.tier !== 'C') {
        this.logger.error(
          `AUTO-BLACKLIST: ${address.slice(0, 8)}... exceeded ${MAX_FAST_DUMP_STRIKES} ` +
          `fast-dump strikes. Downgrading from ${currentScore.tier} to C tier.`,
        );
        const penalizedMetrics = {
          ...currentScore.metrics,
          rugPullCount: Math.max(currentScore.metrics.rugPullCount, 15),
        };
        await this.walletScorerService.scoreWallet(penalizedMetrics);
      }
    }
  }

  /**
   * Send a real-time alert push notification for Circuit Breaker events.
   * Used for critical events that require immediate operator attention.
   */
  async sendCircuitBreakerAlert(
    userId: string,
    walletAddress: string,
    tokenMint: string,
    level: number,
    sellRatioPct: number,
    dumpTimeSecs: number,
  ): Promise<void> {
    try {
      const notifyInfo = await this.notifyService.getUserNotifyInfo(userId);
      if (!notifyInfo) return;

      const title = `⚠️ Circuit Breaker L${level} 触发`;
      const body =
        `钱包 ${walletAddress.slice(0, 8)}... 在复制买入后 ${dumpTimeSecs}s 抛售 ` +
        `${tokenMint.slice(0, 8)}...\n` +
        `已自动减仓 ${sellRatioPct}%`;

      await this.notifyService.sendMessage(userId, {
        type: 'CircuitBreakerAlert',
        title,
        body,
        walletAddress,
        tokenMint,
        level: level.toString(),
        sellRatio: (sellRatioPct / 100).toString(),
      }, notifyInfo.tokens);
    } catch (err) {
      this.logger.error(`Failed to send circuit breaker alert: ${(err as Error)}`);
    }
  }
}
