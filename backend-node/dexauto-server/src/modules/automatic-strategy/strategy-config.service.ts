import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * User-configurable strategy parameters stored in Redis.
 * Each strategy can have its own overrides; unset values use system defaults.
 */
export interface StrategyRiskConfig {
  // ── Trigger Parameters ──
  /** Minimum unique addresses to trigger consensus (default: from strategy.triggers) */
  minConsensusAddresses?: number;
  /** Minimum total SOL to trigger (default: from strategy.triggers) */
  minConsensusSol?: number;

  // ── Copy Trade Filter ──
  /** Minimum single trade SOL amount (default: 0.1) */
  copyAmountMinSol?: number;
  /** Maximum single trade SOL amount — reject if higher (default: 100) */
  copyAmountMaxSol?: number;
  /** Maximum times to increase position on same token (default: 3) */
  maxPositionIncreases?: number;

  // ── Token Security ──
  /** Minimum RugCheck trust score (default: 30) */
  minRugcheckScore?: number;
  /** Allow Token-2022 tokens (default: false for critical extensions) */
  allowToken2022?: boolean;
  /** Minimum liquidity USD (default: 1000) */
  minLiquidityUsd?: number;

  // ── Position Sizing ──
  /** Total budget in SOL for this strategy (default: 10) */
  totalBudgetSol?: number;
  /** Maximum SOL per single trade (default: 1) */
  maxSingleTradeSol?: number;
  /** Maximum concurrent open positions (default: 15) */
  maxConcurrentPositions?: number;
  /** Maximum exposure to one token as % of budget (default: 0.2) */
  maxSingleTokenExposure?: number;

  // ── Exit Rules ──
  /** Fixed stop loss percentage (default: 0.3 = 30%) */
  stopLossPct?: number;
  /** Take profit percentage (default: 2.0 = 200%) */
  takeProfitPct?: number;
  /** Maximum hold time in seconds (default: 7200 = 2 hours) */
  maxHoldTimeSecs?: number;
  /** ATH trailing stop percentage (default: 0.5 = 50% from ATH) */
  athTrailingStopPct?: number;

  // ── Entry Deviation ──
  /** Maximum entry deviation before rejecting (default: 0.15 = 15%) */
  maxEntryDeviationPct?: number;
  /** Deviation above which to reduce position size (default: 0.05 = 5%) */
  reduceDeviationPct?: number;

  // ── Probe Detection ──
  /** Enable probe buy detection (default: true) */
  probeBuyDetection?: boolean;
  /** Probe buy threshold ratio (default: 0.1 = 10% of avg) */
  probeRatioThreshold?: number;
}

const CONFIG_PREFIX = (env: string) => `${env}:DEXAUTO:STRATEGY_CONFIG:`;
const CONFIG_TTL_SECS = 86400 * 365; // 1 year

@Injectable()
export class StrategyConfigService {
  private readonly logger = new Logger(StrategyConfigService.name);
  private readonly prefix: string;

  /** In-memory cache of configs to avoid Redis round-trips on every trade */
  private cache = new Map<string, StrategyRiskConfig>();

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {
    const env = process.env.NODE_ENV?.toUpperCase() ?? 'DEV';
    this.prefix = CONFIG_PREFIX(env);
  }

  /**
   * Get the user's strategy config (from cache or Redis).
   */
  async getConfig(strategyId: string): Promise<StrategyRiskConfig> {
    if (this.cache.has(strategyId)) {
      return this.cache.get(strategyId)!;
    }

    const key = `${this.prefix}${strategyId}`;
    const raw = await this.redisClient.get(key);
    if (!raw) {
      return {};
    }

    try {
      const config = JSON.parse(raw) as StrategyRiskConfig;
      this.cache.set(strategyId, config);
      return config;
    } catch {
      return {};
    }
  }

  /**
   * Update strategy config (merges with existing).
   */
  async updateConfig(
    strategyId: string,
    updates: Partial<StrategyRiskConfig>,
  ): Promise<StrategyRiskConfig> {
    const existing = await this.getConfig(strategyId);
    const merged: Record<string, any> = { ...existing, ...updates };

    // Remove null/undefined values
    for (const key of Object.keys(merged)) {
      if (merged[key] === null || merged[key] === undefined) {
        delete merged[key];
      }
    }

    const redisKey = `${this.prefix}${strategyId}`;
    await this.redisClient.setex(redisKey, CONFIG_TTL_SECS, JSON.stringify(merged));
    this.cache.set(strategyId, merged);

    this.logger.log(
      `Strategy ${strategyId} config updated: ${JSON.stringify(merged)}`,
    );

    return merged;
  }

  /**
   * Delete all overrides for a strategy (revert to defaults).
   */
  async resetConfig(strategyId: string): Promise<void> {
    const key = `${this.prefix}${strategyId}`;
    await this.redisClient.del(key);
    this.cache.delete(strategyId);
    this.logger.log(`Strategy ${strategyId} config reset to defaults`);
  }

  /**
   * Invalidate cache (e.g., after external update).
   */
  invalidateCache(strategyId: string): void {
    this.cache.delete(strategyId);
  }
}
