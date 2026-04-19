import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import Decimal from 'decimal.js';
import { ClickHouseService } from '../../../infrastructure/clickhouse/clickhouse.service';

// ── Interfaces ────────────────────────────────────────────────────────

export interface BacktestConfig {
  /** Number of days to look back */
  lookbackDays: number;
  /** Minimum number of unique smart money wallets buying the same token to trigger */
  triggerAddressCount: number;
  /** Time window (seconds) within which addresses must buy to count as consensus */
  triggerWindowSecs: number;
  /** Fixed SOL amount per trade */
  tradeAmountSol: number;
  /** Stop loss percentage (e.g. 0.3 = 30%) */
  stopLossPct: number;
  /** Take profit percentage (e.g. 1.0 = 100%) */
  takeProfitPct: number;
  /** Max hold time in seconds before forced exit */
  maxHoldTimeSecs: number;
  /** Minimum trade USD value to consider (filters dust) */
  minTradeUsdValue: number;
}

export interface BacktestTradeResult {
  tokenMint: string;
  tokenSymbol?: string;
  /** Epoch seconds when consensus trigger fired */
  entryTime: number;
  /** USD price at entry */
  entryPriceUsd: string;
  /** Epoch seconds of exit */
  exitTime: number;
  /** USD price at exit */
  exitPriceUsd: string;
  /** Exit reason */
  exitReason: 'stop_loss' | 'take_profit' | 'max_hold_time' | 'end_of_data';
  /** PnL percentage */
  pnlPct: number;
  /** SOL PnL */
  pnlSol: number;
  /** Number of smart money addresses that triggered consensus */
  consensusCount: number;
}

export interface BacktestSummary {
  config: BacktestConfig;
  /** Period covered */
  startDate: string;
  endDate: string;
  /** Total unique tokens that triggered consensus */
  totalSignals: number;
  /** Trades executed */
  totalTrades: number;
  /** Winning trades */
  wins: number;
  /** Losing trades */
  losses: number;
  /** Win rate */
  winRatePct: number;
  /** Total PnL in SOL */
  totalPnlSol: number;
  /** Average PnL per trade */
  avgPnlPct: number;
  /** Max single trade profit */
  maxProfitPct: number;
  /** Max single trade loss */
  maxLossPctActual: number;
  /** Sharpe-like ratio (mean / stdev of returns) */
  sharpeRatio: number;
  /** Individual trade results */
  trades: BacktestTradeResult[];
}

// ── Default Config ────────────────────────────────────────────────────

const DEFAULT_CONFIG: BacktestConfig = {
  lookbackDays: 30,
  triggerAddressCount: 3,
  triggerWindowSecs: 120,
  tradeAmountSol: 0.5,
  stopLossPct: 0.3,
  takeProfitPct: 1.0,
  maxHoldTimeSecs: 3600,
  minTradeUsdValue: 10,
};

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(
    private readonly clickHouseService: ClickHouseService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  /**
   * Run a backtest against ClickHouse historical data.
   *
   * Strategy: Replay all dex_trades in chronological order.
   * When N unique smart money addresses buy the same token within a time window,
   * simulate an entry. Track price over subsequent trades to determine exit.
   */
  async runBacktest(
    config: Partial<BacktestConfig> = {},
    smartMoneyAddresses?: string[],
  ): Promise<BacktestSummary> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    // Clamp config values to sane ranges
    cfg.lookbackDays = Math.max(1, Math.min(180, Math.floor(cfg.lookbackDays)));
    cfg.triggerWindowSecs = Math.max(10, Math.min(3600, Math.floor(cfg.triggerWindowSecs)));
    cfg.triggerAddressCount = Math.max(1, Math.min(50, Math.floor(cfg.triggerAddressCount)));
    cfg.minTradeUsdValue = Math.max(0, Math.min(100000, cfg.minTradeUsdValue));
    cfg.maxHoldTimeSecs = Math.max(60, Math.min(86400 * 7, Math.floor(cfg.maxHoldTimeSecs)));

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - cfg.lookbackDays * 86400 * 1000);

    this.logger.log(
      `Starting backtest: ${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}, ` +
      `trigger=${cfg.triggerAddressCount} addrs in ${cfg.triggerWindowSecs}s, ` +
      `SL=${(cfg.stopLossPct * 100).toFixed(0)}%, TP=${(cfg.takeProfitPct * 100).toFixed(0)}%`,
    );

    // Step 1: Fetch smart money buy trades from ClickHouse
    // Sanitize addresses: only allow base58 characters (alphanumeric, no special chars)
    const safeAddresses = (smartMoneyAddresses || []).filter(
      (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a),
    );
    const addressFilter = safeAddresses.length
      ? `AND trader IN (${safeAddresses.map((a) => `'${a}'`).join(',')})`
      : '';

    const tradesQuery = `
      SELECT
        tx_id,
        trader,
        base_mint,
        block_time,
        toFloat64(usd_value) / 100.0 AS usd_value_normalized
      FROM dex_trades
      WHERE block_time >= toDateTime('${startDate.toISOString().slice(0, 19)}')
        AND block_time < toDateTime('${endDate.toISOString().slice(0, 19)}')
        AND usd_value > 0
        AND toFloat64(usd_value) / 100.0 >= ${cfg.minTradeUsdValue}
        ${addressFilter}
      ORDER BY block_time ASC
      LIMIT 500000
    `;

    const trades = await this.clickHouseService.query(tradesQuery);
    if (!trades || trades.length === 0) {
      return this.emptySummary(cfg, startDate, endDate);
    }

    this.logger.log(`Fetched ${trades.length} trades for backtest`);

    // Step 2: Detect consensus triggers
    // Map<tokenMint, Array<{trader, blockTime}>>
    const tokenBuyers = new Map<string, Array<{ trader: string; blockTime: number }>>();

    // Track triggered tokens to avoid duplicate entries
    const triggeredTokens = new Set<string>();
    const tradeResults: BacktestTradeResult[] = [];

    for (const trade of trades) {
      const tokenMint = trade.base_mint;
      const blockTime = typeof trade.block_time === 'number'
        ? trade.block_time
        : new Date(trade.block_time).getTime() / 1000;

      if (!tokenBuyers.has(tokenMint)) {
        tokenBuyers.set(tokenMint, []);
      }

      const buyers = tokenBuyers.get(tokenMint)!;

      // Remove expired entries outside the trigger window
      const windowStart = blockTime - cfg.triggerWindowSecs;
      while (buyers.length > 0 && buyers[0].blockTime < windowStart) {
        buyers.shift();
      }

      // Add current trade (deduplicate by trader within the window)
      const alreadyIn = buyers.some((b) => b.trader === trade.trader);
      if (!alreadyIn) {
        buyers.push({ trader: trade.trader, blockTime });
      }

      // Check if consensus reached
      const uniqueTraders = new Set(buyers.map((b) => b.trader));
      if (
        uniqueTraders.size >= cfg.triggerAddressCount &&
        !triggeredTokens.has(tokenMint)
      ) {
        triggeredTokens.add(tokenMint);

        // Simulate entry at current price
        const entryUsd = new Decimal(trade.usd_value_normalized || '0');
        if (entryUsd.lte(0)) continue;

        // Estimate entry price (usd_value / rough token amount — use usd_value as proxy)
        const result = await this.simulateTrade(
          cfg,
          tokenMint,
          blockTime,
          entryUsd.toFixed(6),
        );
        if (result) {
          tradeResults.push({
            ...result,
            consensusCount: uniqueTraders.size,
          });
        }
      }
    }

    return this.buildSummary(cfg, startDate, endDate, tradeResults);
  }

  /**
   * Simulate a single trade: entry at entryTime, check subsequent price action
   * for stop loss, take profit, or max hold time exit.
   */
  private async simulateTrade(
    cfg: BacktestConfig,
    tokenMint: string,
    entryTimeSecs: number,
    entryUsdValue: string,
  ): Promise<Omit<BacktestTradeResult, 'consensusCount'> | null> {
    // Sanitize tokenMint
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenMint)) return null;

    // Fetch subsequent price action for this token
    const maxExitTime = entryTimeSecs + cfg.maxHoldTimeSecs;
    const priceQuery = `
      SELECT
        block_time,
        toFloat64(usd_value) / 100.0 AS usd_val,
        base_amount
      FROM dex_trades
      WHERE base_mint = '${tokenMint}'
        AND block_time >= toDateTime(${entryTimeSecs})
        AND block_time <= toDateTime(${maxExitTime})
        AND usd_value > 0
        AND base_amount != '0'
      ORDER BY block_time ASC
      LIMIT 1000
    `;

    const priceData = await this.clickHouseService.query(priceQuery);
    if (!priceData || priceData.length === 0) {
      return null;
    }

    // Use the first trade's implied price as entry baseline
    const firstTrade = priceData[0];
    const entryPrice = this.impliedPrice(firstTrade);
    if (!entryPrice || entryPrice.lte(0)) return null;

    let exitReason: BacktestTradeResult['exitReason'] = 'end_of_data';
    let exitPrice = entryPrice;
    let exitTime = entryTimeSecs;

    // Scan price action for exit conditions
    for (const pt of priceData) {
      const price = this.impliedPrice(pt);
      if (!price || price.lte(0)) continue;

      const priceBt = typeof pt.block_time === 'number'
        ? pt.block_time
        : new Date(pt.block_time).getTime() / 1000;

      const changePct = price.sub(entryPrice).div(entryPrice).toNumber();

      // Check stop loss
      if (changePct <= -cfg.stopLossPct) {
        exitReason = 'stop_loss';
        exitPrice = price;
        exitTime = priceBt;
        break;
      }

      // Check take profit
      if (changePct >= cfg.takeProfitPct) {
        exitReason = 'take_profit';
        exitPrice = price;
        exitTime = priceBt;
        break;
      }

      // Update last known price for max_hold_time exit
      exitPrice = price;
      exitTime = priceBt;

      // Check max hold time
      if (priceBt >= maxExitTime) {
        exitReason = 'max_hold_time';
        break;
      }
    }

    const pnlPct = exitPrice.sub(entryPrice).div(entryPrice).toNumber();
    const pnlSol = cfg.tradeAmountSol * pnlPct;

    return {
      tokenMint,
      entryTime: entryTimeSecs,
      entryPriceUsd: entryPrice.toFixed(10),
      exitTime,
      exitPriceUsd: exitPrice.toFixed(10),
      exitReason,
      pnlPct,
      pnlSol,
    };
  }

  private impliedPrice(trade: any): Decimal | null {
    try {
      const usd = new Decimal(trade.usd_val || '0');
      const baseAmount = new Decimal(trade.base_amount || '0').abs();
      if (baseAmount.isZero()) return null;
      return usd.div(baseAmount);
    } catch {
      return null;
    }
  }

  private buildSummary(
    cfg: BacktestConfig,
    startDate: Date,
    endDate: Date,
    trades: BacktestTradeResult[],
  ): BacktestSummary {
    const wins = trades.filter((t) => t.pnlPct >= 0).length;
    const losses = trades.filter((t) => t.pnlPct < 0).length;
    const totalPnl = trades.reduce((s, t) => s + t.pnlSol, 0);
    const pnlPcts = trades.map((t) => t.pnlPct);
    const avgPnl = pnlPcts.length > 0 ? pnlPcts.reduce((s, p) => s + p, 0) / pnlPcts.length : 0;
    const maxProfit = pnlPcts.length > 0 ? Math.max(...pnlPcts) : 0;
    const maxLoss = pnlPcts.length > 0 ? Math.abs(Math.min(...pnlPcts)) : 0;

    // Sharpe-like ratio
    let sharpe = 0;
    if (pnlPcts.length > 1) {
      const mean = avgPnl;
      const variance = pnlPcts.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnlPcts.length - 1);
      const stdev = Math.sqrt(variance);
      sharpe = stdev > 0 ? mean / stdev : 0;
    }

    return {
      config: cfg,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      totalSignals: trades.length,
      totalTrades: trades.length,
      wins,
      losses,
      winRatePct: trades.length > 0 ? (wins / trades.length) * 100 : 0,
      totalPnlSol: Math.round(totalPnl * 10000) / 10000,
      avgPnlPct: Math.round(avgPnl * 10000) / 10000,
      maxProfitPct: Math.round(maxProfit * 10000) / 10000,
      maxLossPctActual: Math.round(maxLoss * 10000) / 10000,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      trades,
    };
  }

  private emptySummary(
    cfg: BacktestConfig,
    startDate: Date,
    endDate: Date,
  ): BacktestSummary {
    return this.buildSummary(cfg, startDate, endDate, []);
  }
}
