import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Decimal from 'decimal.js';

/**
 * Position state tracked in Redis for real-time exit decisions.
 */
export interface TrackedPosition {
  /** Trading order buy ID */
  orderId: string;
  /** Token mint address */
  tokenMint: string;
  /** Entry price in USD */
  entryPriceUsd: string;
  /** Entry time (epoch ms) */
  entryTimeMs: number;
  /** Current price in USD (updated on each check) */
  currentPriceUsd: string;
  /** All-time high price since entry (USD) */
  athPriceUsd: string;
  /** Time of ATH (epoch ms) */
  athTimeMs: number;
  /** Wallet address */
  walletAddress: string;
  /** User ID */
  userId: string;
  /** Strategy ID */
  strategyId: string;
  /** Remaining position ratio (1.0 = full, reduced by partial sells) */
  remainingRatio: string;
  /** The smart money wallet address that triggered this buy (for follow-sell matching) */
  sourceWalletAddress: string;
  /** Whether source smart money wallet has sold */
  sourceWalletSellRatio: string;
  /** Batch TP/SL rules (Phase 4: GMGN-style multi-rule exit) */
  batchRules?: BatchTPSLRule[];
  /** IDs of batch rules that have already triggered (for onlyOnce) */
  triggeredRuleIds?: string[];
}

/**
 * A single take-profit or stop-loss rule in a batch configuration.
 * Multiple rules can coexist; each triggers independently.
 *
 * Example config:
 *   rule 1: takeProfit  +50%  → sell 30% (recover cost)
 *   rule 2: takeProfit +200%  → sell 30% (lock profit)
 *   rule 3: takeProfit +500%  → sell 30% (big win)
 *   rule 4: stopLoss   -30%   → sell 100% (cut losses)
 */
export interface BatchTPSLRule {
  /** Unique rule ID (e.g. "tp1", "sl1") */
  id: string;
  /** Rule type */
  type: 'takeProfit' | 'stopLoss';
  /** Trigger percentage from entry price (e.g. 0.5 = +50%, -0.3 = -30%) */
  triggerPct: number;
  /** Ratio of remaining position to sell when triggered (0-1) */
  sellRatio: number;
  /** If true, this rule fires at most once per position (reset on add-buy) */
  onlyOnce: boolean;
}

/**
 * Exit decision from the position monitor.
 */
export interface ExitDecision {
  action: 'sell' | 'hold';
  /** Ratio of remaining position to sell (0.0 - 1.0) */
  sellRatio: number;
  reason: string;
  rule: string;
}

export interface PositionMonitorConfig {
  /** Fixed stop loss percentage (0.3 = 30% loss triggers sell) */
  fixedStopLossPct: number;
  /** Time-based rule 1: seconds after entry with no 5% gain → sell 50% */
  rule1TimeSecs: number;
  rule1MinGainPct: number;
  rule1SellRatio: number;
  /** Time-based rule 2: seconds still losing → sell 30% more */
  rule2TimeSecs: number;
  rule2SellRatio: number;
  /** Time-based rule 3: seconds from ATH + drawdown → sell all */
  rule3TimeSecs: number;
  rule3DrawdownPct: number;
  /** Time-based rule 4: source wallet sold 50%+ → sell 70% */
  rule4SourceSellThreshold: number;
  rule4SellRatio: number;
  /** Time-based rule 5: seconds still losing → force close all */
  rule5TimeSecs: number;
  /** Time-based rule 6: hours to reduce profitable positions by half */
  rule6TimeHours: number;
  rule6SellRatio: number;
  /** Trailing stop: activate after this gain %, trail by drawdown % */
  trailingStopActivationPct: number;
  trailingStopDrawdownPct: number;
}

const DEFAULT_CONFIG: PositionMonitorConfig = {
  fixedStopLossPct: 0.30,
  rule1TimeSecs: 30,
  rule1MinGainPct: 0.05,
  rule1SellRatio: 0.50,
  rule2TimeSecs: 180,
  rule2SellRatio: 0.30,
  rule3TimeSecs: 60,
  rule3DrawdownPct: 0.15,
  rule4SourceSellThreshold: 0.50,
  rule4SellRatio: 0.70,
  rule5TimeSecs: 300,    // 5 minutes (v2.1: tightened from 10min)
  rule6TimeHours: 24,
  rule6SellRatio: 0.50,
  trailingStopActivationPct: 0.50,  // Activate trailing stop after 50% gain
  trailingStopDrawdownPct: 0.20,    // Trail with 20% drawdown from ATH
};

const POSITION_CACHE_PREFIX = (env: string) =>
  `${env}:DEXAUTO:POSITION_MONITOR:`;
const POSITION_TTL_SECS = 86400 * 2; // 2 days

@Injectable()
export class PositionMonitorService {
  private readonly logger = new Logger(PositionMonitorService.name);
  private readonly config: PositionMonitorConfig;
  private readonly cachePrefix: string;

  constructor(
    private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    this.config = { ...DEFAULT_CONFIG };
    this.cachePrefix = POSITION_CACHE_PREFIX(
      this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase(),
    );
  }

  /**
   * Register a new position for monitoring after a successful buy.
   */
  async trackPosition(position: TrackedPosition): Promise<void> {
    const key = this.positionKey(position.orderId);
    await this.redisClient.setex(
      key,
      POSITION_TTL_SECS,
      JSON.stringify(position),
    );
    this.logger.log(
      `Tracking position ${position.orderId}: ${position.tokenMint} entry=$${position.entryPriceUsd}`,
    );
  }

  /**
   * Reanchor a position's entry price and reset Batch-TP/SL `triggeredRuleIds`
   * after averaging in (e.g., the copy-strategy fires a second buy on the same
   * token). Without this:
   *   - Batch TP rules anchored to the original entry fire spuriously
   *     (original entry is cheaper → +200% threshold already met after add-buy)
   *   - Or rules fail to fire (averaged up → original +50% is now below avg)
   *   - `triggeredRuleIds` onlyOnce is permanently locked across re-entries
   *
   * Caller passes the NEW weighted avg entry price. ATH is preserved so trailing
   * stop still anchors to the highest price seen since the ORIGINAL entry —
   * trailing stop mechanics don't need reset (it's a drawdown tracker).
   */
  async reanchorPositionOnAddBuy(
    orderId: string,
    newWeightedEntryPriceUsd: string,
  ): Promise<void> {
    const key = this.positionKey(orderId);
    const raw = await this.redisClient.get(key);
    if (!raw) return;
    try {
      const pos: TrackedPosition = JSON.parse(raw);
      const oldEntry = pos.entryPriceUsd;
      pos.entryPriceUsd = newWeightedEntryPriceUsd;
      pos.triggeredRuleIds = []; // Reset — new entry means new TP/SL ladder
      await this.redisClient.setex(key, POSITION_TTL_SECS, JSON.stringify(pos));
      this.logger.log(
        `Position ${orderId} reanchored after add-buy: entry $${oldEntry} → $${newWeightedEntryPriceUsd}, ` +
        `Batch TP/SL triggered flags reset`,
      );
    } catch (err) {
      this.logger.warn(`Failed to reanchor position ${orderId}: ${(err as Error)}`);
    }
  }

  /**
   * Update current price for a tracked position and evaluate exit rules.
   * Returns an exit decision.
   */
  async evaluatePosition(
    orderId: string,
    currentPriceUsd: string,
    sourceWalletSellRatio?: string,
  ): Promise<ExitDecision> {
    const key = this.positionKey(orderId);
    const raw = await this.redisClient.get(key);

    if (!raw) {
      return { action: 'hold', sellRatio: 0, reason: 'Position not tracked', rule: 'none' };
    }

    const pos: TrackedPosition = JSON.parse(raw);
    const now = Date.now();

    // Update current price (keep existing if caller passes empty string)
    if (currentPriceUsd && currentPriceUsd !== '') {
      pos.currentPriceUsd = currentPriceUsd;
    }

    // Update source wallet sell ratio if provided
    if (sourceWalletSellRatio !== undefined) {
      pos.sourceWalletSellRatio = sourceWalletSellRatio;
    }

    // Use the (possibly unchanged) position price for calculations
    const currentPrice = new Decimal(pos.currentPriceUsd || pos.entryPriceUsd);
    const athPrice = new Decimal(pos.athPriceUsd || pos.entryPriceUsd);
    if (currentPrice.gt(athPrice)) {
      pos.athPriceUsd = currentPrice.toFixed();
      pos.athTimeMs = now;
    }

    // Run exit rules (priority order: most urgent first)
    const decision = this.runExitRules(pos, now);

    // Persist updated position state
    await this.redisClient.setex(key, POSITION_TTL_SECS, JSON.stringify(pos));

    if (decision.action === 'sell') {
      this.logger.warn(
        `EXIT SIGNAL for ${orderId}: sell ${(decision.sellRatio * 100).toFixed(0)}% — ${decision.reason}`,
      );
    }

    return decision;
  }

  /**
   * Remove a position from tracking (after full exit).
   */
  async removePosition(orderId: string): Promise<void> {
    const key = this.positionKey(orderId);
    await this.redisClient.del(key);
  }

  /**
   * Update remaining ratio after a partial sell.
   */
  async updateRemainingRatio(orderId: string, newRatio: number): Promise<void> {
    const key = this.positionKey(orderId);
    const raw = await this.redisClient.get(key);
    if (!raw) return;

    const pos: TrackedPosition = JSON.parse(raw);
    pos.remainingRatio = newRatio.toString();

    if (newRatio <= 0.001) {
      // Position fully exited
      await this.redisClient.del(key);
      this.logger.log(`Position ${orderId} fully exited, removed from tracking`);
    } else {
      await this.redisClient.setex(key, POSITION_TTL_SECS, JSON.stringify(pos));
    }
  }

  /**
   * Core exit rule engine. Evaluates all rules in priority order.
   *
   * Rule execution order (highest priority first):
   * 1. Fixed stop loss (immediate protection)
   * 2. Trailing stop (lock in profits)
   * 3. 30-second stagnation (early exit for duds)
   * 4. 60-second ATH drawdown (momentum died)
   * 5. Source wallet sold (follow the smart money out)
   * 6. 3-minute still losing (reduce further)
   * 7. 5-minute force close (v2.1: tightened from 10min)
   * 8. 24-hour profit reduction (long-term risk management)
   */
  private runExitRules(pos: TrackedPosition, now: number): ExitDecision {
    const entryPrice = new Decimal(pos.entryPriceUsd || '0');
    const currentPrice = new Decimal(pos.currentPriceUsd || pos.entryPriceUsd || '0');
    const athPrice = new Decimal(pos.athPriceUsd || pos.entryPriceUsd || '0');
    const holdingTimeMs = now - pos.entryTimeMs;
    const timeSinceAthMs = now - pos.athTimeMs;
    const remaining = new Decimal(pos.remainingRatio || '1');

    // Skip if position already fully exited
    if (remaining.lte(0.001)) {
      return { action: 'hold', sellRatio: 0, reason: 'Position already exited', rule: 'none' };
    }

    // Guard against zero entry price (shouldn't happen, but defensive)
    if (entryPrice.lte(0)) {
      return { action: 'hold', sellRatio: 0, reason: 'Invalid entry price', rule: 'none' };
    }

    const priceChangeFromEntry = currentPrice.sub(entryPrice).div(entryPrice).toNumber();
    const priceChangeFromAth = athPrice.gt(0)
      ? currentPrice.sub(athPrice).div(athPrice).toNumber()
      : 0;

    // ── Rule 1: Fixed stop loss ──
    // If price drops 30%+ from entry → sell ALL remaining immediately
    if (priceChangeFromEntry <= -this.config.fixedStopLossPct) {
      return {
        action: 'sell',
        sellRatio: 1.0,
        reason: `Fixed stop loss: ${(priceChangeFromEntry * 100).toFixed(1)}% loss exceeds -${this.config.fixedStopLossPct * 100}% threshold`,
        rule: 'fixed_stop_loss',
      };
    }

    // ── Rule 2: Trailing stop ──
    // Activated once ATH reached +50% from entry (sticky — stays active even if price retraces below +50%)
    // Then fires when current price drops 20%+ from ATH
    const athChangeFromEntry = athPrice.gt(0)
      ? athPrice.sub(entryPrice).div(entryPrice).toNumber()
      : 0;
    if (athChangeFromEntry >= this.config.trailingStopActivationPct &&
        priceChangeFromAth <= -this.config.trailingStopDrawdownPct) {
      return {
        action: 'sell',
        sellRatio: 1.0,
        reason: `Trailing stop: gained ${(priceChangeFromEntry * 100).toFixed(1)}% but dropped ${(-priceChangeFromAth * 100).toFixed(1)}% from ATH`,
        rule: 'trailing_stop',
      };
    }

    // ── Rule 2.5: Batch TP/SL (Phase 4 — GMGN-style multi-rule exit) ──
    if (pos.batchRules && pos.batchRules.length > 0) {
      const triggered = new Set(pos.triggeredRuleIds ?? []);

      // Evaluate stop-loss rules first (more urgent), then take-profit
      const sortedRules = [...pos.batchRules].sort((a, b) => {
        if (a.type === 'stopLoss' && b.type !== 'stopLoss') return -1;
        if (a.type !== 'stopLoss' && b.type === 'stopLoss') return 1;
        // Within same type, sort by trigger severity
        return a.type === 'stopLoss'
          ? a.triggerPct - b.triggerPct   // Most aggressive SL first (e.g. -20% before -30%)
          : b.triggerPct - a.triggerPct;  // Highest TP first (e.g. +500% before +200%)
      });

      for (const rule of sortedRules) {
        // Skip already-triggered onlyOnce rules
        if (rule.onlyOnce && triggered.has(rule.id)) continue;

        let fires = false;
        if (rule.type === 'stopLoss') {
          // StopLoss: triggerPct is negative (e.g. -0.3 = -30%)
          fires = priceChangeFromEntry <= rule.triggerPct;
        } else {
          // TakeProfit: triggerPct is positive (e.g. 0.5 = +50%)
          fires = priceChangeFromEntry >= rule.triggerPct;
        }

        if (fires) {
          // Mark rule as triggered
          if (rule.onlyOnce) {
            if (!pos.triggeredRuleIds) pos.triggeredRuleIds = [];
            pos.triggeredRuleIds.push(rule.id);
          }
          const pctLabel = (rule.triggerPct * 100).toFixed(0);
          const typeLabel = rule.type === 'takeProfit' ? 'Take Profit' : 'Stop Loss';
          return {
            action: 'sell' as const,
            sellRatio: rule.sellRatio,
            reason: `Batch ${typeLabel} [${rule.id}]: price ${(priceChangeFromEntry * 100).toFixed(1)}% hit ${pctLabel}% threshold → sell ${(rule.sellRatio * 100).toFixed(0)}%`,
            rule: `batch_${rule.type}_${rule.id}`,
          };
        }
      }
    }

    // ── Rule 3: 30-second stagnation ──
    // If 30 seconds passed and price hasn't gained 5% → sell 50%
    if (holdingTimeMs > this.config.rule1TimeSecs * 1000 &&
        priceChangeFromEntry < this.config.rule1MinGainPct) {
      return {
        action: 'sell',
        sellRatio: this.config.rule1SellRatio,
        reason: `30s stagnation: only ${(priceChangeFromEntry * 100).toFixed(1)}% gain (need ${this.config.rule1MinGainPct * 100}%)`,
        rule: 'stagnation_30s',
      };
    }

    // ── Rule 4: 60-second ATH drawdown ──
    // If 60 seconds since ATH and price dropped 15%+ from ATH → sell all
    if (timeSinceAthMs > this.config.rule3TimeSecs * 1000 &&
        priceChangeFromAth < -this.config.rule3DrawdownPct) {
      return {
        action: 'sell',
        sellRatio: 1.0,
        reason: `60s no new ATH + ${(-priceChangeFromAth * 100).toFixed(1)}% drawdown from ATH`,
        rule: 'ath_drawdown_60s',
      };
    }

    // ── Rule 5: Source wallet sold ──
    // If the smart money we followed has sold 50%+ → sell 70%
    const sourceWalletSellRatio = new Decimal(pos.sourceWalletSellRatio || '0').toNumber();
    if (sourceWalletSellRatio >= this.config.rule4SourceSellThreshold) {
      return {
        action: 'sell',
        sellRatio: this.config.rule4SellRatio,
        reason: `Source wallet sold ${(sourceWalletSellRatio * 100).toFixed(0)}%+ → follow sell`,
        rule: 'follow_sell',
      };
    }

    // ── Rule 6: 3-minute still losing ──
    // If still losing after 3 minutes → sell 30% more
    if (holdingTimeMs > this.config.rule2TimeSecs * 1000 &&
        priceChangeFromEntry < 0) {
      return {
        action: 'sell',
        sellRatio: this.config.rule2SellRatio,
        reason: `3min still losing: ${(priceChangeFromEntry * 100).toFixed(1)}%`,
        rule: 'losing_3min',
      };
    }

    // ── Rule 7: 5-minute force close (v2.1: tightened from 10min) ──
    // After 30s (-50%) and 3min (-30%), remaining position is ~20% of original
    // Not worth waiting longer; 5 minutes is sufficient recovery window
    if (holdingTimeMs > this.config.rule5TimeSecs * 1000 &&
        priceChangeFromEntry < 0) {
      return {
        action: 'sell',
        sellRatio: 1.0,
        reason: `5min force close: still losing ${(priceChangeFromEntry * 100).toFixed(1)}% after ${this.config.rule5TimeSecs}s`,
        rule: 'force_close_5min',
      };
    }

    // ── Rule 8: 24-hour profit reduction ──
    // Even profitable positions should reduce risk exposure after 24 hours
    if (holdingTimeMs > this.config.rule6TimeHours * 3600 * 1000) {
      return {
        action: 'sell',
        sellRatio: this.config.rule6SellRatio,
        reason: `24h risk reduction: holding for ${(holdingTimeMs / 3600000).toFixed(1)}h`,
        rule: 'risk_reduction_24h',
      };
    }

    return { action: 'hold', sellRatio: 0, reason: 'All rules passed — hold', rule: 'none' };
  }

  private positionKey(orderId: string): string {
    return `${this.cachePrefix}${orderId}`;
  }
}
