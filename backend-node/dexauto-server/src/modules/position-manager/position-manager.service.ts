import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Decimal from 'decimal.js';
import { DailyLossCircuitBreakerService } from './daily-loss-circuit-breaker.service';

// ── Interfaces ────────────────────────────────────────────────────────

export interface PositionEntry {
  /** Unique entry ID */
  entryId: string;
  /** Transaction signature */
  txSignature: string;
  /** Token amount bought */
  tokenAmount: string;
  /** SOL spent (gross, excluding fees) */
  solAmount: string;
  /** USD value at entry */
  usdValue: string;
  /** Entry price per token (USD) */
  pricePerToken: string;
  /** Timestamp (epoch ms) */
  timestampMs: number;
  /** Source smart money address that triggered this buy */
  sourceWalletAddress: string;
  /**
   * Total fees paid for this entry in SOL (priority fee + bribery + Jito tip + any DEX fees).
   * On small-amount trades (<0.5 SOL), fees can consume 5-20% of position size and
   * flip apparent profit into loss, so we track separately and net them out in PnL.
   * Defaults to 0 for backward compatibility with pre-fee-aware entries.
   */
  feesSol?: string;
}

export interface PositionExit {
  /** Unique exit ID */
  exitId: string;
  /** Transaction signature */
  txSignature: string;
  /** Token amount sold */
  tokenAmount: string;
  /** SOL received (gross, before fees) */
  solAmount: string;
  /** USD value at exit */
  usdValue: string;
  /** Exit price per token (USD) */
  pricePerToken: string;
  /** Timestamp (epoch ms) */
  timestampMs: number;
  /** Exit reason (rule name) */
  reason: string;
  /** Total fees paid for this exit in SOL (priority + bribery + Jito + DEX). Default 0 for back-compat. */
  feesSol?: string;
}

export interface ManagedPosition {
  /** User ID */
  userId: string;
  /** Token mint address */
  tokenMint: string;
  /** User's wallet address */
  walletAddress: string;
  /** Strategy ID that triggered the position */
  strategyId: string;
  /** All buy entries for this position */
  entries: PositionEntry[];
  /** All sell exits for this position */
  exits: PositionExit[];
  /** Current total token amount held */
  currentTokenAmount: string;
  /** Cost basis per token (weighted average USD) */
  avgEntryPriceUsd: string;
  /** Total SOL invested */
  totalSolInvested: string;
  /** Total SOL recovered from sells */
  totalSolRecovered: string;
  /** Realized PnL in SOL */
  realizedPnlSol: string;
  /** Realized PnL in USD */
  realizedPnlUsd: string;
  /** Position creation time (epoch ms) */
  createdAtMs: number;
  /** Last updated time (epoch ms) */
  updatedAtMs: number;
  /** Whether position is fully closed */
  isClosed: boolean;
}

export interface PositionSummary {
  tokenMint: string;
  currentTokenAmount: string;
  avgEntryPriceUsd: string;
  totalSolInvested: string;
  totalSolRecovered: string;
  realizedPnlSol: string;
  unrealizedPnlUsd: string;
  entryCount: number;
  exitCount: number;
  isClosed: boolean;
}

// ── Service ───────────────────────────────────────────────────────────

const POSITION_PREFIX = (env: string) => `${env}:DEXAUTO:POSITION_MGR:`;
const POSITION_INDEX_PREFIX = (env: string) => `${env}:DEXAUTO:POSITION_MGR_IDX:`;
const POSITION_TTL_SECS = 86400 * 30; // 30 days

@Injectable()
export class PositionManagerService {
  private readonly logger = new Logger(PositionManagerService.name);
  private readonly prefix: string;
  private readonly indexPrefix: string;

  /**
   * Callback to reanchor the tracked position's entry price + reset Batch-TP/SL
   * flags when averaging in. Wired in AppModule to avoid circular DI with
   * PositionMonitorService; kept as a forward-compatible hook.
   */
  private onAddBuyCallback?: (orderId: string, newWeightedEntryPriceUsd: string) => Promise<void>;

  registerOnAddBuyCallback(
    cb: (orderId: string, newWeightedEntryPriceUsd: string) => Promise<void>,
  ): void {
    this.onAddBuyCallback = cb;
  }

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    @Optional() private readonly dailyLossCircuitBreaker?: DailyLossCircuitBreakerService,
  ) {
    const env = this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase();
    this.prefix = POSITION_PREFIX(env);
    this.indexPrefix = POSITION_INDEX_PREFIX(env);
  }

  // ── Position Lifecycle ──────────────────────────────────────────────

  /**
   * Record a buy entry. Creates or appends to an existing open position.
   */
  async recordBuy(
    userId: string,
    tokenMint: string,
    walletAddress: string,
    strategyId: string,
    entry: PositionEntry,
  ): Promise<ManagedPosition> {
    const posKey = this.positionKey(userId, tokenMint);

    let pos = await this.getPosition(userId, tokenMint);

    if (pos && !pos.isClosed) {
      // Add to existing position (averaging in)
      pos.entries.push(entry);
      pos.currentTokenAmount = new Decimal(pos.currentTokenAmount)
        .add(entry.tokenAmount)
        .toString();
      pos.totalSolInvested = new Decimal(pos.totalSolInvested)
        .add(entry.solAmount)
        .toString();
      pos.avgEntryPriceUsd = this.recalcAvgEntryPrice(pos);
      pos.updatedAtMs = Date.now();

      // Reanchor TrackedPosition in PositionMonitorService so Batch TP/SL rules
      // re-reference the NEW weighted avg entry, not the original buy price.
      // The entry.entryId maps 1:1 to trackedPosition.orderId when the caller
      // uses a consistent ID scheme.
      if (this.onAddBuyCallback && pos.entries.length > 0) {
        const firstOrderId = pos.entries[0].entryId;
        this.onAddBuyCallback(firstOrderId, pos.avgEntryPriceUsd).catch((err) => {
          this.logger.warn(`onAddBuyCallback failed for ${firstOrderId}: ${(err as Error)}`);
        });
      }
    } else {
      // Create new position
      pos = {
        userId,
        tokenMint,
        walletAddress,
        strategyId,
        entries: [entry],
        exits: [],
        currentTokenAmount: entry.tokenAmount,
        avgEntryPriceUsd: entry.pricePerToken,
        totalSolInvested: entry.solAmount,
        totalSolRecovered: '0',
        realizedPnlSol: '0',
        realizedPnlUsd: '0',
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        isClosed: false,
      };
    }

    await this.savePosition(pos);

    this.logger.log(
      `BUY recorded: ${tokenMint.slice(0, 8)}... +${entry.tokenAmount} tokens @ $${entry.pricePerToken} ` +
      `(${pos.entries.length} entries, holding ${pos.currentTokenAmount})`,
    );

    return pos;
  }

  /**
   * Record a sell exit. Updates position state, computes realized PnL.
   */
  async recordSell(
    userId: string,
    tokenMint: string,
    exit: PositionExit,
  ): Promise<ManagedPosition | null> {
    const pos = await this.getPosition(userId, tokenMint);
    if (!pos || pos.isClosed) {
      this.logger.warn(`No open position for ${tokenMint} to record sell`);
      return null;
    }

    pos.exits.push(exit);

    const soldAmount = new Decimal(exit.tokenAmount);
    const remaining = new Decimal(pos.currentTokenAmount).sub(soldAmount);
    pos.currentTokenAmount = Decimal.max(remaining, 0).toString();

    pos.totalSolRecovered = new Decimal(pos.totalSolRecovered)
      .add(exit.solAmount)
      .toString();

    // Calculate realized PnL for this exit.
    // Cost basis per token stays constant across partial sells, so proportion uses
    // TOTAL tokens ever bought (sum of entries) as the denominator.
    const totalTokensBought = pos.entries.reduce(
      (sum, e) => sum.add(e.tokenAmount),
      new Decimal(0),
    );
    const costBasis = new Decimal(pos.avgEntryPriceUsd).mul(soldAmount);
    const proceeds = new Decimal(exit.usdValue);
    const thisPnlUsd = proceeds.sub(costBasis);
    pos.realizedPnlUsd = new Decimal(pos.realizedPnlUsd).add(thisPnlUsd).toString();

    const solCostBasis = totalTokensBought.gt(0)
      ? new Decimal(pos.totalSolInvested).mul(soldAmount).div(totalTokensBought)
      : new Decimal(0);
    const solProceeds = new Decimal(exit.solAmount);

    // Net fees into realized PnL. On buy side, apportion this exit's share of
    // the accumulated entry fees (proportional to tokens sold). On sell side,
    // subtract this exit's fees directly.
    const totalEntryFees = pos.entries.reduce(
      (sum, e) => sum.add(new Decimal(e.feesSol || '0')),
      new Decimal(0),
    );
    const apportionedEntryFees = totalTokensBought.gt(0)
      ? totalEntryFees.mul(soldAmount).div(totalTokensBought)
      : new Decimal(0);
    const exitFees = new Decimal(exit.feesSol || '0');
    const netFeesThisExit = apportionedEntryFees.add(exitFees);

    pos.realizedPnlSol = new Decimal(pos.realizedPnlSol)
      .add(solProceeds.sub(solCostBasis).sub(netFeesThisExit))
      .toString();

    // Check if fully closed
    if (new Decimal(pos.currentTokenAmount).lte(0)) {
      pos.isClosed = true;
      pos.currentTokenAmount = '0';
    }

    pos.updatedAtMs = Date.now();
    await this.savePosition(pos);

    // Accumulate realized SOL PnL (NET of fees) into today's running total so
    // the daily-loss circuit breaker reflects real capital movement, not gross.
    if (this.dailyLossCircuitBreaker) {
      const pnlSolThisExit = solProceeds.sub(solCostBasis).sub(netFeesThisExit);
      await this.dailyLossCircuitBreaker.recordRealizedPnl(
        pos.userId,
        pnlSolThisExit.toFixed(),
      );
    }

    this.logger.log(
      `SELL recorded: ${tokenMint.slice(0, 8)}... -${exit.tokenAmount} tokens @ $${exit.pricePerToken} ` +
      `(PnL: $${thisPnlUsd.toFixed(2)}, remaining: ${pos.currentTokenAmount}, closed: ${pos.isClosed})`,
    );

    return pos;
  }

  // ── Query ───────────────────────────────────────────────────────────

  /**
   * Get position for a user + token.
   */
  async getPosition(userId: string, tokenMint: string): Promise<ManagedPosition | null> {
    const key = this.positionKey(userId, tokenMint);
    const raw = await this.redisClient.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ManagedPosition;
    } catch {
      return null;
    }
  }

  /**
   * Get all open positions for a user.
   */
  async getOpenPositions(userId: string): Promise<ManagedPosition[]> {
    const indexKey = this.indexKey(userId);
    const tokenMints = await this.redisClient.smembers(indexKey);

    const positions: ManagedPosition[] = [];
    for (const mint of tokenMints) {
      const pos = await this.getPosition(userId, mint);
      if (pos && !pos.isClosed) {
        positions.push(pos);
      }
    }

    return positions;
  }

  /**
   * Get a summary of a position (for API responses).
   */
  async getPositionSummary(
    userId: string,
    tokenMint: string,
    currentPriceUsd?: string,
  ): Promise<PositionSummary | null> {
    const pos = await this.getPosition(userId, tokenMint);
    if (!pos) return null;

    let unrealizedPnlUsd = '0';
    if (currentPriceUsd && !pos.isClosed) {
      const currentValue = new Decimal(currentPriceUsd).mul(pos.currentTokenAmount);
      const costBasis = new Decimal(pos.avgEntryPriceUsd).mul(pos.currentTokenAmount);
      unrealizedPnlUsd = currentValue.sub(costBasis).toString();
    }

    return {
      tokenMint: pos.tokenMint,
      currentTokenAmount: pos.currentTokenAmount,
      avgEntryPriceUsd: pos.avgEntryPriceUsd,
      totalSolInvested: pos.totalSolInvested,
      totalSolRecovered: pos.totalSolRecovered,
      realizedPnlSol: pos.realizedPnlSol,
      unrealizedPnlUsd,
      entryCount: pos.entries.length,
      exitCount: pos.exits.length,
      isClosed: pos.isClosed,
    };
  }

  /**
   * Count how many position increases (buys) exist for a user + token.
   * Useful for CopyTradeFilter.maxPositionIncreases check.
   */
  async getPositionIncreaseCount(userId: string, tokenMint: string): Promise<number> {
    const pos = await this.getPosition(userId, tokenMint);
    if (!pos || pos.isClosed) return 0;
    return pos.entries.length;
  }

  // ── Internal ────────────────────────────────────────────────────────

  private recalcAvgEntryPrice(pos: ManagedPosition): string {
    let totalValue = new Decimal(0);
    let totalTokens = new Decimal(0);

    for (const entry of pos.entries) {
      totalValue = totalValue.add(
        new Decimal(entry.pricePerToken).mul(entry.tokenAmount),
      );
      totalTokens = totalTokens.add(entry.tokenAmount);
    }

    // Subtract tokens already sold
    const soldTokens = pos.exits.reduce(
      (sum, exit) => sum.add(exit.tokenAmount),
      new Decimal(0),
    );
    const remainingTokens = totalTokens.sub(soldTokens);

    if (remainingTokens.lte(0)) return '0';

    // Average entry price is total cost / total tokens purchased
    // (not affected by sells — cost basis doesn't change)
    return totalValue.div(totalTokens).toString();
  }

  private async savePosition(pos: ManagedPosition): Promise<void> {
    const key = this.positionKey(pos.userId, pos.tokenMint);
    await this.redisClient.setex(key, POSITION_TTL_SECS, JSON.stringify(pos));

    // Maintain index of user positions
    const indexKey = this.indexKey(pos.userId);
    if (pos.isClosed) {
      await this.redisClient.srem(indexKey, pos.tokenMint);
    } else {
      await this.redisClient.sadd(indexKey, pos.tokenMint);
      await this.redisClient.expire(indexKey, POSITION_TTL_SECS);
    }
  }

  private positionKey(userId: string, tokenMint: string): string {
    return `${this.prefix}${userId}:${tokenMint}`;
  }

  private indexKey(userId: string): string {
    return `${this.indexPrefix}${userId}`;
  }
}
