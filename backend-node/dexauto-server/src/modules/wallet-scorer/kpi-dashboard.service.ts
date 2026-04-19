import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { WalletScorerService } from './wallet-scorer.service';
import { WashTradeDetectorService } from './wash-trade-detector';
import { ExitLiquidityDetectorService } from './exit-liquidity-detector';

// ── Interfaces ────────────────────────────────────────────────────────

/**
 * System health KPI dashboard — tracks first-tier performance metrics.
 *
 * Target KPIs (from SMART_MONEY_UPGRADE_PLAN §8.6):
 *   Signal→Trade latency:  < 3s (target < 1s)
 *   False signal filter:   > 80% (target > 90%)
 *   Rug Pull interception: > 90% (target > 95%)
 *   Entry deviation (med):  < 10% (target < 5%)
 *   30-day win rate:        > 30% (target > 45%)
 *   Max single loss:        < 50% (target < 30%)
 *   Monthly return:         > 0% (target > 20%)
 *   Uptime:                 > 99% (target > 99.5%)
 *   Address pool active:    > 60% (target > 80%)
 *   Follow-sell trigger:    > 70% (target > 90%)
 */
export interface SystemKPI {
  /** Date string YYYY-MM-DD */
  date: string;
  /** Average signal-to-trade latency in milliseconds */
  signalToTradeLatencyMs: number;
  /** Percentage of signals filtered out before execution (0-100) */
  falseSignalFilterPct: number;
  /** Percentage of detected rug pulls that were blocked (0-100) */
  rugPullInterceptionPct: number;
  /** Median entry price deviation from smart money (0-1) */
  medianEntryDeviationPct: number;
  /** 30-day rolling win rate (0-1) */
  winRate30d: number;
  /** Maximum single-trade loss percentage (0-1) */
  maxSingleLossPct: number;
  /** Monthly total return percentage */
  monthlyReturnPct: number;
  /** System uptime percentage (0-100) */
  uptimePct: number;
  /** Percentage of monitored addresses that had recent activity (0-100) */
  addressPoolActivePct: number;
  /** Percentage of smart money sells where we also sold (0-100) */
  followSellTriggerPct: number;
  /** Number of trades executed today */
  tradesExecuted: number;
  /** Number of signals received today */
  signalsReceived: number;
  /** Number of rug pulls detected today */
  rugPullsDetected: number;
  /** Number of wash trade alerts today */
  washTradeAlerts: number;
  /** Number of exit-liquidity farmers flagged */
  exitLiquidityFarmers: number;
  /** Wallet scorer tier distribution */
  tierDistribution: { S: number; A: number; B: number; C: number };
}

/** Rolling metric counters updated in real-time */
export interface MetricCounters {
  signalsReceived: number;
  signalsFiltered: number;
  tradesExecuted: number;
  tradesFailed: number;
  rugPullsDetected: number;
  rugPullsBlocked: number;
  followSellTriggered: number;
  followSellOpportunities: number;
  totalLatencyMs: number;
  latencyCount: number;
  wins: number;
  losses: number;
  maxLossPct: number;
  totalPnlSol: number;
  deviationSum: number;
  deviationCount: number;
  deviations: number[];
}

// ── Constants ─────────────────────────────────────────────────────────

const KPI_CACHE_PREFIX = (env: string) => `${env}:DEXAUTO:KPI:`;
const KPI_TTL_SECS = 86400 * 90; // 90 days
const COUNTERS_KEY = (env: string) => `${env}:DEXAUTO:KPI_COUNTERS`;

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class KpiDashboardService {
  private readonly logger = new Logger(KpiDashboardService.name);
  private readonly kpiPrefix: string;
  private readonly countersKey: string;

  /** Today's rolling counters (reset at midnight) */
  private counters: MetricCounters = this.newCounters();

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly walletScorerService: WalletScorerService,
    private readonly washTradeDetector: WashTradeDetectorService,
    private readonly exitLiquidityDetector: ExitLiquidityDetectorService,
  ) {
    const env = process.env.NODE_ENV?.toUpperCase() ?? 'DEV';
    this.kpiPrefix = KPI_CACHE_PREFIX(env);
    this.countersKey = COUNTERS_KEY(env);
  }

  // ── Real-time metric recording ────────────────────────────────────

  /** Record a signal received */
  recordSignal(): void {
    this.counters.signalsReceived++;
  }

  /** Record a signal that was filtered out (not traded) */
  recordFilteredSignal(): void {
    this.counters.signalsFiltered++;
  }

  /** Record a successful trade execution with latency */
  recordTradeExecution(latencyMs: number): void {
    this.counters.tradesExecuted++;
    this.counters.totalLatencyMs += latencyMs;
    this.counters.latencyCount++;
  }

  /** Record a failed trade */
  recordTradeFailed(): void {
    this.counters.tradesFailed++;
  }

  /** Record a completed trade result (win or loss) */
  recordTradeResult(pnlSol: number, pnlPct: number): void {
    this.counters.totalPnlSol += pnlSol;
    if (pnlSol >= 0) {
      this.counters.wins++;
    } else {
      this.counters.losses++;
      const lossPct = Math.abs(pnlPct);
      if (lossPct > this.counters.maxLossPct) {
        this.counters.maxLossPct = lossPct;
      }
    }
  }

  /** Record a rug pull detection */
  recordRugPullDetected(blocked: boolean): void {
    this.counters.rugPullsDetected++;
    if (blocked) {
      this.counters.rugPullsBlocked++;
    }
  }

  /** Record a follow-sell opportunity and whether we triggered */
  recordFollowSellOpportunity(triggered: boolean): void {
    this.counters.followSellOpportunities++;
    if (triggered) {
      this.counters.followSellTriggered++;
    }
  }

  /** Record entry price deviation for a trade */
  recordEntryDeviation(deviationPct: number): void {
    this.counters.deviationSum += deviationPct;
    this.counters.deviationCount++;
    this.counters.deviations.push(deviationPct);
  }

  // ── KPI Snapshot ──────────────────────────────────────────────────

  /**
   * Build today's KPI snapshot from accumulated counters.
   */
  buildSnapshot(): SystemKPI {
    const c = this.counters;
    const date = new Date().toISOString().slice(0, 10);

    // Calculate median deviation
    let medianDeviation = 0;
    if (c.deviations.length > 0) {
      const sorted = [...c.deviations].sort((a, b) => a - b);
      medianDeviation = sorted[Math.floor(sorted.length / 2)];
    }

    // Tier distribution from wallet scorer
    const scores = this.walletScorerService.getAllScores();
    const tierDist = { S: 0, A: 0, B: 0, C: 0 };
    for (const score of scores.values()) {
      tierDist[score.tier]++;
    }

    // Wash trade + exit liquidity stats
    const washStats = this.washTradeDetector.getStats();
    const totalAddresses = scores.size;
    const activeAddresses = Array.from(scores.values()).filter(
      (s) => Date.now() - s.lastScoredMs < 7 * 86400 * 1000,
    ).length;

    const totalTrades = c.wins + c.losses;

    return {
      date,
      signalToTradeLatencyMs: c.latencyCount > 0
        ? Math.round(c.totalLatencyMs / c.latencyCount)
        : 0,
      falseSignalFilterPct: c.signalsReceived > 0
        ? (c.signalsFiltered / c.signalsReceived) * 100
        : 0,
      rugPullInterceptionPct: c.rugPullsDetected > 0
        ? (c.rugPullsBlocked / c.rugPullsDetected) * 100
        : 0,
      medianEntryDeviationPct: medianDeviation,
      winRate30d: totalTrades > 0 ? c.wins / totalTrades : 0,
      maxSingleLossPct: c.maxLossPct,
      monthlyReturnPct: 0, // Needs historical aggregation
      uptimePct: 100, // Would be tracked by external monitoring
      addressPoolActivePct: totalAddresses > 0
        ? (activeAddresses / totalAddresses) * 100
        : 0,
      followSellTriggerPct: c.followSellOpportunities > 0
        ? (c.followSellTriggered / c.followSellOpportunities) * 100
        : 0,
      tradesExecuted: c.tradesExecuted,
      signalsReceived: c.signalsReceived,
      rugPullsDetected: c.rugPullsDetected,
      washTradeAlerts: washStats.totalAlerts,
      exitLiquidityFarmers: 0, // Loaded at persist time
      tierDistribution: tierDist,
    };
  }

  /**
   * Get the current live KPI snapshot (not persisted yet).
   */
  getLiveKPI(): SystemKPI {
    return this.buildSnapshot();
  }

  /**
   * Get historical KPI for a specific date.
   */
  async getHistoricalKPI(date: string): Promise<SystemKPI | null> {
    const key = `${this.kpiPrefix}${date}`;
    const raw = await this.redisClient.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SystemKPI;
    } catch {
      return null;
    }
  }

  /**
   * Get KPI history for the last N days.
   */
  async getKPIHistory(days = 30): Promise<SystemKPI[]> {
    const results: SystemKPI[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const kpi = await this.getHistoricalKPI(dateStr);
      if (kpi) results.push(kpi);
    }

    return results.reverse();
  }

  /**
   * Format KPI as a Telegram-friendly message.
   */
  formatTelegramMessage(kpi: SystemKPI): string {
    const check = (val: number, min: number, target: number) => {
      if (val >= target) return '✅';
      if (val >= min) return '🟡';
      return '❌';
    };

    return [
      `📊 *Daily KPI Report — ${kpi.date}*`,
      '',
      `⏱ Signal→Trade: *${kpi.signalToTradeLatencyMs}ms* ${check(1000 / Math.max(kpi.signalToTradeLatencyMs, 1) * 1000, 333, 1000)}`,
      `🛡 False Signal Filter: *${kpi.falseSignalFilterPct.toFixed(0)}%* ${check(kpi.falseSignalFilterPct, 80, 90)}`,
      `🔒 Rug Pull Block: *${kpi.rugPullInterceptionPct.toFixed(0)}%* ${check(kpi.rugPullInterceptionPct, 90, 95)}`,
      `📐 Entry Deviation: *${(kpi.medianEntryDeviationPct * 100).toFixed(1)}%* ${check(100 - kpi.medianEntryDeviationPct * 100, 90, 95)}`,
      `🎯 Win Rate: *${(kpi.winRate30d * 100).toFixed(0)}%* ${check(kpi.winRate30d * 100, 30, 45)}`,
      `📉 Max Loss: *${(kpi.maxSingleLossPct * 100).toFixed(0)}%* ${check(100 - kpi.maxSingleLossPct * 100, 50, 70)}`,
      `👛 Address Pool Active: *${kpi.addressPoolActivePct.toFixed(0)}%* ${check(kpi.addressPoolActivePct, 60, 80)}`,
      `🔄 Follow-Sell: *${kpi.followSellTriggerPct.toFixed(0)}%* ${check(kpi.followSellTriggerPct, 70, 90)}`,
      '',
      `📈 Trades: ${kpi.tradesExecuted} | Signals: ${kpi.signalsReceived}`,
      `🚨 Rug Pulls: ${kpi.rugPullsDetected} | Wash Alerts: ${kpi.washTradeAlerts}`,
      `🏷 Tiers: S=${kpi.tierDistribution.S} A=${kpi.tierDistribution.A} B=${kpi.tierDistribution.B} C=${kpi.tierDistribution.C}`,
    ].join('\n');
  }

  // ── Scheduled Tasks ───────────────────────────────────────────────

  /**
   * Persist daily KPI snapshot at 23:55 UTC every day.
   */
  @Cron('55 23 * * *')
  async persistDailyKPI(): Promise<void> {
    const kpi = this.buildSnapshot();
    const key = `${this.kpiPrefix}${kpi.date}`;

    await this.redisClient.setex(key, KPI_TTL_SECS, JSON.stringify(kpi));

    this.logger.log(
      `Daily KPI persisted for ${kpi.date}: ` +
      `trades=${kpi.tradesExecuted}, winRate=${(kpi.winRate30d * 100).toFixed(0)}%, ` +
      `latency=${kpi.signalToTradeLatencyMs}ms, deviation=${(kpi.medianEntryDeviationPct * 100).toFixed(1)}%`,
    );

    // Publish daily KPI report to Redis pub/sub for notification services to pick up
    const report = this.formatTelegramMessage(kpi);
    await this.redisClient.publish('dexauto:kpi:daily', JSON.stringify({
      date: kpi.date,
      report,
      kpi,
    }));
  }

  /**
   * Reset counters at midnight UTC.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  resetDailyCounters(): void {
    this.logger.log('Resetting daily KPI counters');
    this.counters = this.newCounters();
  }

  // ── Internal ────────────────────────────────────────────────────────

  private newCounters(): MetricCounters {
    return {
      signalsReceived: 0,
      signalsFiltered: 0,
      tradesExecuted: 0,
      tradesFailed: 0,
      rugPullsDetected: 0,
      rugPullsBlocked: 0,
      followSellTriggered: 0,
      followSellOpportunities: 0,
      totalLatencyMs: 0,
      latencyCount: 0,
      wins: 0,
      losses: 0,
      maxLossPct: 0,
      totalPnlSol: 0,
      deviationSum: 0,
      deviationCount: 0,
      deviations: [],
    };
  }
}
