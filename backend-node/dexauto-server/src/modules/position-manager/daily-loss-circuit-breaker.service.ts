import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Decimal from 'decimal.js';

/**
 * DailyLossCircuitBreakerService — system-wide daily loss cap.
 *
 * Copy trading is a structurally negative-sum game for followers (they end up
 * providing exit liquidity to the leader). Our per-trade defenses
 * (Probe Buy / Circuit Breaker / Entry Deviation) reduce the blast radius of
 * each single trade, but cannot eliminate the long-tail risk of a strategy
 * silently bleeding capital over many trades on a bad market day.
 *
 * This service enforces a system-level "maximum daily loss" per user.
 * When the cumulative realized + unrealized loss for the day exceeds
 * the configured threshold, `isTradingPaused()` returns true and the
 * strategy executor short-circuits before placing new buys.
 *
 * Reset: automatic at midnight UTC (via TTL).
 */

export interface DailyLossConfig {
  /** Absolute max loss in SOL for the UTC day (null = disabled) */
  maxDailyLossSol: number | null;
  /** Max loss as ratio of totalBudgetSol (null = disabled) */
  maxDailyLossRatio: number | null;
}

const DEFAULT_CONFIG: DailyLossConfig = {
  maxDailyLossSol: 2.0,      // halt trading after 2 SOL net loss in a UTC day
  maxDailyLossRatio: 0.20,   // or 20% of daily budget, whichever is lower
};

const DAILY_PNL_PREFIX = (env: string) =>
  `${env}:DEXAUTO:DAILY_PNL:`;
const PAUSE_FLAG_PREFIX = (env: string) =>
  `${env}:DEXAUTO:DAILY_PAUSE:`;

/** TTL set slightly over 24h so the counter auto-resets at UTC midnight */
const DAILY_TTL_SECS = 86400 + 3600;

@Injectable()
export class DailyLossCircuitBreakerService {
  private readonly logger = new Logger(DailyLossCircuitBreakerService.name);
  private readonly pnlPrefix: string;
  private readonly pausePrefix: string;
  private config: DailyLossConfig = { ...DEFAULT_CONFIG };

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    const env = this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase();
    this.pnlPrefix = DAILY_PNL_PREFIX(env);
    this.pausePrefix = PAUSE_FLAG_PREFIX(env);
  }

  updateConfig(patch: Partial<DailyLossConfig>): void {
    this.config = { ...this.config, ...patch };
    this.logger.log(
      `Daily loss config: maxSol=${this.config.maxDailyLossSol}, ` +
      `maxRatio=${this.config.maxDailyLossRatio}`,
    );
  }

  /**
   * Record a realized PnL (positive = profit, negative = loss) for today.
   * Called after each sell exit.
   */
  async recordRealizedPnl(userId: string, pnlSol: string): Promise<void> {
    const key = this.pnlKey(userId);
    const delta = new Decimal(pnlSol);
    // INCRBYFLOAT accepts negative values; when key doesn't exist it initializes to 0.
    const newTotal = await this.redisClient.incrbyfloat(key, delta.toNumber());
    await this.redisClient.expire(key, DAILY_TTL_SECS);

    const total = new Decimal(newTotal);
    if (total.isNegative()) {
      await this.checkPauseThreshold(userId, total);
    }
  }

  /**
   * Check whether trading is currently paused for this user due to daily loss.
   * Called by the strategy executor BEFORE placing a new buy.
   */
  async isTradingPaused(userId: string): Promise<boolean> {
    const flag = await this.redisClient.get(this.pauseKey(userId));
    return flag === '1';
  }

  /**
   * Get the current day's net PnL in SOL (negative = loss).
   */
  async getTodayPnlSol(userId: string): Promise<number> {
    const raw = await this.redisClient.get(this.pnlKey(userId));
    return raw ? parseFloat(raw) : 0;
  }

  /**
   * Manually unpause trading (e.g., operator override via admin endpoint).
   * Logs the override so reviewers see who cleared the flag.
   */
  async resumeTrading(userId: string, reason: string): Promise<void> {
    await this.redisClient.del(this.pauseKey(userId));
    this.logger.warn(
      `Trading RESUMED for user ${userId} by operator override: ${reason}`,
    );
  }

  private async checkPauseThreshold(userId: string, netPnlSol: Decimal): Promise<void> {
    if (netPnlSol.gte(0)) return;
    const absLoss = netPnlSol.abs();

    let exceeded = false;
    let reason = '';

    if (this.config.maxDailyLossSol !== null &&
        absLoss.toNumber() >= this.config.maxDailyLossSol) {
      exceeded = true;
      reason = `absolute loss ${absLoss.toFixed(3)} SOL >= ${this.config.maxDailyLossSol} SOL threshold`;
    }

    if (!exceeded && this.config.maxDailyLossRatio !== null) {
      // Compare against totalBudgetSol from the fund allocator defaults (not per-user budget —
      // a per-user budget hook can be added later via config service).
      const budget = this.configService.get<number>('TOTAL_BUDGET_SOL', 10);
      const lossRatio = absLoss.toNumber() / budget;
      if (lossRatio >= this.config.maxDailyLossRatio) {
        exceeded = true;
        reason = `loss ratio ${(lossRatio * 100).toFixed(1)}% >= ${(this.config.maxDailyLossRatio * 100)}% threshold`;
      }
    }

    if (exceeded) {
      await this.redisClient.setex(this.pauseKey(userId), DAILY_TTL_SECS, '1');
      this.logger.error(
        `DAILY LOSS CIRCUIT BREAKER TRIGGERED for user ${userId}: ${reason}. ` +
        `All new buy orders will be blocked until UTC midnight or manual resume.`,
      );
    }
  }

  private pnlKey(userId: string): string {
    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    return `${this.pnlPrefix}${userId}:${dateKey}`;
  }

  private pauseKey(userId: string): string {
    const dateKey = new Date().toISOString().slice(0, 10);
    return `${this.pausePrefix}${userId}:${dateKey}`;
  }
}
