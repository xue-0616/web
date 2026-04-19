import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * PriorityFeeOracleService — dynamic Solana priority fee suggestion.
 *
 * Problem: `tradingSetting.priorityFee` is configured statically by the user
 * and doesn't adapt to network congestion. During spikes (e.g. major launch,
 * token migration waves), static fees cause mass transaction failures because
 * validators prioritize higher-fee txs.
 *
 * Solution: Poll Solana RPC's `getRecentPrioritizationFees` endpoint and
 * maintain a rolling percentile statistic. Downstream consumers call
 * `suggestPriorityFee()` to get a congestion-adjusted fee.
 *
 * Returned value is a MULTIPLIER on the user's base `tradingSetting.priorityFee`
 * (not an absolute replacement) — this preserves user preference while scaling
 * with network load.
 */

export interface PriorityFeeStats {
  /** Median recent priority fee in micro-lamports */
  p50: number;
  /** 75th percentile */
  p75: number;
  /** 90th percentile */
  p90: number;
  /** Max observed */
  max: number;
  /** Number of samples */
  samples: number;
  /** Timestamp (epoch ms) */
  updatedAtMs: number;
}

const CACHE_PREFIX = (env: string) => `${env}:DEXAUTO:PRIORITY_FEE:`;
const STATS_TTL_SECS = 30; // refresh every 30s
const POLL_INTERVAL_MS = 10_000; // poll RPC every 10s
const MAX_HISTORY_SIZE = 200;

/** Treat >2x increase over baseline p90 as "congested" */
const CONGESTION_MULTIPLIER = 2.0;

/**
 * Baseline p90 for uncongested Solana (in micro-lamports per CU).
 * Measured empirically — ~10000-30000 is typical for quiet hours.
 * Used as a sanity-check ceiling so a single anomalous sample can't
 * distort the multiplier.
 */
const BASELINE_P90 = 20_000;

@Injectable()
export class PriorityFeeOracleService {
  private readonly logger = new Logger(PriorityFeeOracleService.name);
  private readonly cachePrefix: string;
  private readonly rpcUrl: string | undefined;
  private pollTimer: NodeJS.Timeout | null = null;
  private cachedStats: PriorityFeeStats | null = null;
  private recentSamples: number[] = [];

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    const env = this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase();
    this.cachePrefix = CACHE_PREFIX(env);
    this.rpcUrl = this.configService.get<string>('SOLANA_RPC_URL');
  }

  onModuleInit(): void {
    if (!this.rpcUrl) {
      this.logger.warn(
        'SOLANA_RPC_URL not set — dynamic priority fee oracle disabled, ' +
          'static user fees will be used.',
      );
      return;
    }
    this.startPolling();
  }

  onModuleDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  /**
   * Get the current stats. Reads from in-memory cache first, falls back to Redis.
   */
  async getStats(): Promise<PriorityFeeStats | null> {
    if (this.cachedStats && Date.now() - this.cachedStats.updatedAtMs < STATS_TTL_SECS * 1000) {
      return this.cachedStats;
    }
    const raw = await this.redisClient.get(`${this.cachePrefix}STATS`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PriorityFeeStats;
      this.cachedStats = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Suggest a priority fee multiplier (1.0 = no adjustment).
   *
   * Logic:
   *   p90 <= baseline        → 1.0×   (normal)
   *   p90 2-4× baseline      → 1.5×   (mild congestion)
   *   p90 4-10× baseline     → 2.5×   (heavy congestion)
   *   p90 >10× baseline      → 4.0×   (extreme congestion — landing matters more than cost)
   *
   * Downstream consumers apply this multiplier to
   * `tradingSetting.priorityFee` before submitting to the trading server.
   */
  async suggestMultiplier(): Promise<number> {
    const stats = await this.getStats();
    if (!stats || stats.samples < 5) return 1.0;

    const ratio = stats.p90 / BASELINE_P90;
    if (ratio <= 1.0) return 1.0;
    if (ratio <= CONGESTION_MULTIPLIER) return 1.0;
    if (ratio <= 4) return 1.5;
    if (ratio <= 10) return 2.5;
    return 4.0;
  }

  /**
   * Compute the effective priority fee (in micro-lamports) for a trade.
   * Takes the user-configured base fee as BigInt and returns the adjusted fee.
   * Safely handles all-zero and missing stats.
   */
  async computeEffectiveFee(baseFee: bigint): Promise<bigint> {
    const multiplier = await this.suggestMultiplier();
    if (multiplier === 1.0) return baseFee;
    // BigInt math: multiply by integer numerator/denominator to preserve precision
    const numerator = BigInt(Math.round(multiplier * 1000));
    return (baseFee * numerator) / 1000n;
  }

  // ── Internal: Polling ───────────────────────────────────────────────

  private startPolling(): void {
    // Kick off first poll immediately, then every POLL_INTERVAL_MS
    this.pollOnce();
    this.pollTimer = setInterval(() => this.pollOnce(), POLL_INTERVAL_MS);
  }

  private async pollOnce(): Promise<void> {
    if (!this.rpcUrl) return;
    try {
      const resp = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getRecentPrioritizationFees',
          params: [],
        }),
        signal: AbortSignal.timeout(3000),
      });
      const data = (await resp.json()) as any;
      const fees: Array<{ slot: number; prioritizationFee: number }> = data?.result ?? [];
      if (fees.length === 0) return;

      // Extract the fees, discard zero-fee slots (they skew the percentiles low)
      const nonZeroFees = fees
        .map((f) => Number(f.prioritizationFee))
        .filter((f) => f > 0);

      if (nonZeroFees.length === 0) return;

      // Merge into rolling history (most recent MAX_HISTORY_SIZE samples)
      this.recentSamples = [...this.recentSamples, ...nonZeroFees].slice(-MAX_HISTORY_SIZE);

      const stats = this.computePercentiles(this.recentSamples);
      this.cachedStats = stats;
      await this.redisClient.setex(
        `${this.cachePrefix}STATS`,
        STATS_TTL_SECS,
        JSON.stringify(stats),
      );
    } catch (err) {
      this.logger.warn(`Priority fee poll failed: ${(err as Error)}`);
    }
  }

  private computePercentiles(samples: number[]): PriorityFeeStats {
    const sorted = [...samples].sort((a, b) => a - b);
    const pct = (p: number): number =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

    return {
      p50: pct(0.5),
      p75: pct(0.75),
      p90: pct(0.9),
      max: sorted[sorted.length - 1],
      samples: sorted.length,
      updatedAtMs: Date.now(),
    };
  }
}
