import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Decimal from 'decimal.js';
import { ParsedDexSwap } from './parsers/dex-swap-parser';
import {
  PositionMonitorService,
  TrackedPosition,
} from '../position-monitor/position-monitor.service';
import { KpiDashboardService } from '../wallet-scorer/kpi-dashboard.service';

/**
 * Tracks smart money holdings so we can compute sell ratios.
 */
interface SmartMoneyHolding {
  /** Trader address */
  trader: string;
  /** Token mint */
  tokenMint: string;
  /** Current estimated holding amount (raw token units, bigint string) */
  holdingAmount: string;
  /** Last updated timestamp (epoch ms) */
  lastUpdatedMs: number;
}

const HOLDING_CACHE_PREFIX = (env: string) =>
  `${env}:DEXAUTO:FOLLOW_SELL:HOLDING:`;
const HOLDING_TTL_SECS = 86400 * 7; // 7 days

/**
 * FollowSellService — Detects when a tracked smart money wallet sells
 * a token we hold, and triggers a proportional sell via the position monitor.
 *
 * Flow:
 * 1. GeyserSubscriberService detects a sell swap from a smart money address
 * 2. We compute what % of their holding they sold
 * 3. We update the sourceWalletSellRatio on matching tracked positions
 * 4. The position monitor's next evaluation will pick up the sell signal
 *    via Rule 5 (source wallet sold 50%+ → sell 70%)
 *
 * This integrates with the existing PositionMonitorService exit rules
 * rather than executing sells directly, keeping the sell decision unified.
 */
@Injectable()
export class FollowSellService {
  private readonly logger = new Logger(FollowSellService.name);
  private readonly cachePrefix: string;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    private readonly positionMonitorService: PositionMonitorService,
    private readonly kpiDashboard: KpiDashboardService,
  ) {
    this.cachePrefix = HOLDING_CACHE_PREFIX(
      this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase(),
    );
  }

  /**
   * Called when a smart money buy is detected — track their holding increase.
   */
  async onSmartMoneyBuy(swap: ParsedDexSwap): Promise<void> {
    const holdingKey = this.holdingKey(swap.trader, swap.base_mint);
    const existing = await this.getHolding(holdingKey);

    const newAmount = new Decimal(existing?.holdingAmount || '0')
      .plus(swap.base_amount)
      .toFixed(0);

    const holding: SmartMoneyHolding = {
      trader: swap.trader,
      tokenMint: swap.base_mint,
      holdingAmount: newAmount,
      lastUpdatedMs: Date.now(),
    };

    await this.redisClient.setex(
      holdingKey,
      HOLDING_TTL_SECS,
      JSON.stringify(holding),
    );

    this.logger.debug(
      `Updated holding: ${swap.trader.slice(0, 8)}... ${swap.base_mint.slice(0, 8)}... = ${newAmount}`,
    );
  }

  /**
   * Called when a smart money sell is detected.
   * Computes sell ratio and updates all matching tracked positions.
   */
  async onSmartMoneySell(swap: ParsedDexSwap): Promise<void> {
    const holdingKey = this.holdingKey(swap.trader, swap.base_mint);
    const existing = await this.getHolding(holdingKey);

    if (!existing || existing.holdingAmount === '0') {
      // We don't have baseline data for this wallet+token combo.
      // Use the sold amount as 100% (assume they sold everything we know about).
      this.logger.debug(
        `No holding data for ${swap.trader.slice(0, 8)}... selling ${swap.base_mint.slice(0, 8)}...`,
      );
      await this.updatePositionSellRatio(swap.trader, swap.base_mint, '1.0');
      return;
    }

    const holdingBefore = new Decimal(existing.holdingAmount);
    const soldAmount = new Decimal(swap.base_amount);

    if (holdingBefore.lte(0)) {
      await this.updatePositionSellRatio(swap.trader, swap.base_mint, '1.0');
      return;
    }

    // Compute cumulative sell ratio
    const sellRatio = Decimal.min(
      soldAmount.div(holdingBefore),
      new Decimal('1.0'),
    );

    // Update remaining holding
    const remainingHolding = Decimal.max(
      holdingBefore.minus(soldAmount),
      new Decimal('0'),
    ).toFixed(0);

    const updated: SmartMoneyHolding = {
      ...existing,
      holdingAmount: remainingHolding,
      lastUpdatedMs: Date.now(),
    };
    await this.redisClient.setex(
      holdingKey,
      HOLDING_TTL_SECS,
      JSON.stringify(updated),
    );

    this.logger.log(
      `Smart money sell detected: ${swap.trader.slice(0, 8)}... sold ${sellRatio.mul(100).toFixed(1)}% of ${swap.base_mint.slice(0, 8)}...`,
    );

    // Update the sourceWalletSellRatio on all matching tracked positions
    await this.updatePositionSellRatio(
      swap.trader,
      swap.base_mint,
      sellRatio.toFixed(4),
    );
  }

  /**
   * Find all tracked positions that were triggered by this smart money address
   * for this token, and update their sourceWalletSellRatio.
   *
   * The PositionMonitorService will evaluate the sell ratio on its next check
   * and trigger the follow-sell exit rule if threshold is met.
   */
  private async updatePositionSellRatio(
    traderAddress: string,
    tokenMint: string,
    sellRatio: string,
  ): Promise<void> {
    try {
      // Scan Redis for matching positions
      // Pattern: {prefix}* — we need to scan all tracked positions
      const posPrefix = this.configService
        .get<string>('NODE_ENV', 'DEV')
        .toUpperCase();
      const posPattern = `${posPrefix}:DEXAUTO:POSITION_MONITOR:*`;

      let cursor = '0';
      const matchingOrderIds: string[] = [];

      do {
        const [nextCursor, keys] = await this.redisClient.scan(
          cursor,
          'MATCH',
          posPattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        for (const key of keys) {
          const raw = await this.redisClient.get(key);
          if (!raw) continue;

          try {
            const pos: TrackedPosition = JSON.parse(raw);
            // Match positions triggered specifically by THIS smart money address.
            // Otherwise, one wallet selling would inappropriately trigger follow-sell
            // on positions originated by other independent smart money wallets.
            if (
              pos.tokenMint === tokenMint &&
              pos.sourceWalletAddress === traderAddress
            ) {
              matchingOrderIds.push(pos.orderId);
            }
          } catch {
            // Skip malformed entries
          }
        }
      } while (cursor !== '0');

      // Update each matching position's sourceWalletSellRatio
      for (const orderId of matchingOrderIds) {
        // Use evaluatePosition to trigger the exit rule evaluation
        // This will update the sourceWalletSellRatio and check all rules
        await this.positionMonitorService.evaluatePosition(
          orderId,
          '', // currentPriceUsd will be fetched by the monitor
          sellRatio,
        );
      }

      if (matchingOrderIds.length > 0) {
        this.logger.log(
          `Updated sell ratio (${sellRatio}) for ${matchingOrderIds.length} position(s) ` +
            `of ${tokenMint.slice(0, 8)}...`,
        );
        this.kpiDashboard.recordFollowSellOpportunity(true);
      } else {
        this.kpiDashboard.recordFollowSellOpportunity(false);
      }
    } catch (err) {
      this.logger.error(
        `Failed to update position sell ratios: ${(err as Error)}`,
      );
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async getHolding(key: string): Promise<SmartMoneyHolding | null> {
    const raw = await this.redisClient.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private holdingKey(trader: string, tokenMint: string): string {
    return `${this.cachePrefix}${trader}:${tokenMint}`;
  }
}
