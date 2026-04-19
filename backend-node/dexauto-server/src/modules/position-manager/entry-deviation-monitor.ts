import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import Decimal from 'decimal.js';

// ── Interfaces ────────────────────────────────────────────────────────

export interface DeviationCheckResult {
  /** Whether to proceed with the trade */
  proceed: boolean;
  /** Entry price deviation from smart money's avg entry (0-1, e.g. 0.05 = 5%) */
  deviationPct: number;
  /** Adjustment ratio for position size (1.0 = no adjustment) */
  adjustedAllocRatio: number;
  /** Reason for the decision */
  reason: string;
}

export interface DeviationRecord {
  tokenMint: string;
  smartMoneyAvgPriceUsd: string;
  ourQuotePriceUsd: string;
  deviationPct: number;
  proceeded: boolean;
  timestamp: number;
}

export interface DeviationStats {
  /** Total deviation checks performed */
  totalChecks: number;
  /** Average deviation percentage */
  avgDeviationPct: number;
  /** Median deviation percentage */
  medianDeviationPct: number;
  /** Number of trades skipped due to deviation */
  skippedCount: number;
  /** Percentage of trades skipped */
  skippedPct: number;
  /** P90 deviation (90th percentile) */
  p90DeviationPct: number;
}

// ── Config ────────────────────────────────────────────────────────────

export interface DeviationConfig {
  /** Maximum allowed deviation before rejecting trade (e.g. 0.15 = 15%) */
  maxDeviationPct: number;
  /** Deviation above which position size is reduced (e.g. 0.05 = 5%) */
  reduceThresholdPct: number;
  /** Number of recent records to keep for stats */
  maxRecordHistory: number;
}

const DEFAULT_CONFIG: DeviationConfig = {
  maxDeviationPct: 0.15,
  reduceThresholdPct: 0.05,
  maxRecordHistory: 1000,
};

// ── Service ───────────────────────────────────────────────────────────

const DEVIATION_CACHE_PREFIX = (env: string) =>
  `${env}:DEXAUTO:ENTRY_DEVIATION:`;
const STATS_TTL_SECS = 86400; // 1 day

@Injectable()
export class EntryDeviationMonitorService {
  private readonly logger = new Logger(EntryDeviationMonitorService.name);
  private readonly cachePrefix: string;
  private config: DeviationConfig;

  /** Rolling history of deviation records for stats */
  private records: DeviationRecord[] = [];

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {
    const env = process.env.NODE_ENV?.toUpperCase() ?? 'DEV';
    this.cachePrefix = DEVIATION_CACHE_PREFIX(env);
    this.config = { ...DEFAULT_CONFIG };
  }

  // ── Public API ──────────────────────────────────────────────────────

  updateConfig(newConfig: Partial<DeviationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log(
      `Deviation config updated: max=${(this.config.maxDeviationPct * 100).toFixed(0)}%, ` +
      `reduce=${(this.config.reduceThresholdPct * 100).toFixed(0)}%`,
    );
  }

  /**
   * Check entry price deviation between our quote price and smart money's average entry.
   *
   * Decision logic:
   * - Deviation > maxDeviationPct (15%): REJECT — too expensive, skip trade
   * - Deviation 5%-15%: PROCEED with reduced position size
   * - Deviation < 5%: PROCEED normally
   *
   * @param smartMoneyAvgPriceUsd Smart money's average entry price for this token (USD per token)
   * @param ourQuotePriceUsd Our current quote price from Jupiter (USD per token)
   * @param tokenMint Token mint for logging
   */
  checkDeviation(
    smartMoneyAvgPriceUsd: string,
    ourQuotePriceUsd: string,
    tokenMint: string,
  ): DeviationCheckResult {
    const smPrice = new Decimal(smartMoneyAvgPriceUsd);
    const ourPrice = new Decimal(ourQuotePriceUsd);

    if (smPrice.isZero()) {
      this.logger.warn(`Smart money avg price is 0 for ${tokenMint.slice(0, 8)}...`);
      return {
        proceed: true,
        deviationPct: 0,
        adjustedAllocRatio: 1.0,
        reason: 'Smart money avg price is 0, proceeding with default allocation',
      };
    }

    // Deviation: how much more expensive our entry is vs smart money
    // Positive = we pay more (worse), Negative = we pay less (better)
    const deviation = ourPrice.sub(smPrice).div(smPrice).toNumber();

    // Record for stats
    const record: DeviationRecord = {
      tokenMint,
      smartMoneyAvgPriceUsd,
      ourQuotePriceUsd,
      deviationPct: deviation,
      proceeded: true, // Updated below if rejected
      timestamp: Date.now(),
    };

    let result: DeviationCheckResult;

    if (deviation > this.config.maxDeviationPct) {
      // Too expensive — skip
      record.proceeded = false;
      result = {
        proceed: false,
        deviationPct: deviation,
        adjustedAllocRatio: 0,
        reason: `Entry deviation ${(deviation * 100).toFixed(1)}% > ${(this.config.maxDeviationPct * 100).toFixed(0)}% max — trade rejected`,
      };
      this.logger.warn(
        `DEVIATION REJECT for ${tokenMint.slice(0, 8)}...: ` +
        `${(deviation * 100).toFixed(1)}% > ${(this.config.maxDeviationPct * 100).toFixed(0)}% ` +
        `(SM=$${smartMoneyAvgPriceUsd}, ours=$${ourQuotePriceUsd})`,
      );
    } else if (deviation > this.config.reduceThresholdPct) {
      // Somewhat expensive — reduce position
      const adjustedRatio = Math.max(0, 1 - deviation);
      result = {
        proceed: true,
        deviationPct: deviation,
        adjustedAllocRatio: adjustedRatio,
        reason: `Entry deviation ${(deviation * 100).toFixed(1)}% — position reduced to ${(adjustedRatio * 100).toFixed(0)}%`,
      };
      this.logger.log(
        `DEVIATION REDUCE for ${tokenMint.slice(0, 8)}...: ` +
        `${(deviation * 100).toFixed(1)}%, alloc → ${(adjustedRatio * 100).toFixed(0)}%`,
      );
    } else {
      // Acceptable — proceed normally
      result = {
        proceed: true,
        deviationPct: deviation,
        adjustedAllocRatio: 1.0,
        reason: deviation <= 0
          ? `Entry deviation ${(deviation * 100).toFixed(1)}% — better price than smart money`
          : `Entry deviation ${(deviation * 100).toFixed(1)}% — within acceptable range`,
      };
    }

    this.addRecord(record);
    return result;
  }

  /**
   * Get deviation statistics for dashboard / KPI monitoring.
   */
  getStats(): DeviationStats {
    if (this.records.length === 0) {
      return {
        totalChecks: 0,
        avgDeviationPct: 0,
        medianDeviationPct: 0,
        skippedCount: 0,
        skippedPct: 0,
        p90DeviationPct: 0,
      };
    }

    const deviations = this.records
      .map((r) => r.deviationPct)
      .sort((a, b) => a - b);

    const sum = deviations.reduce((s, d) => s + d, 0);
    const skipped = this.records.filter((r) => !r.proceeded).length;

    const medianIdx = Math.floor(deviations.length / 2);
    const p90Idx = Math.floor(deviations.length * 0.9);

    return {
      totalChecks: this.records.length,
      avgDeviationPct: sum / deviations.length,
      medianDeviationPct: deviations[medianIdx],
      skippedCount: skipped,
      skippedPct: (skipped / this.records.length) * 100,
      p90DeviationPct: deviations[p90Idx],
    };
  }

  /**
   * Get recent deviation records for dashboard.
   */
  getRecentRecords(limit = 50): DeviationRecord[] {
    return this.records.slice(-limit);
  }

  /**
   * Persist daily stats to Redis for KPI dashboard.
   */
  async persistDailyStats(): Promise<void> {
    const stats = this.getStats();
    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `${this.cachePrefix}STATS:${dateKey}`;
    await this.redisClient.setex(key, STATS_TTL_SECS * 30, JSON.stringify(stats));
    this.logger.log(
      `Daily deviation stats persisted: avg=${(stats.avgDeviationPct * 100).toFixed(1)}%, ` +
      `median=${(stats.medianDeviationPct * 100).toFixed(1)}%, ` +
      `skipped=${stats.skippedPct.toFixed(0)}%`,
    );
  }

  // ── Internal ────────────────────────────────────────────────────────

  private addRecord(record: DeviationRecord): void {
    this.records.push(record);
    if (this.records.length > this.config.maxRecordHistory) {
      this.records = this.records.slice(-this.config.maxRecordHistory);
    }
  }
}
