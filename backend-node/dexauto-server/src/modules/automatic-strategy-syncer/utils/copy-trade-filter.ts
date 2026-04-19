import { Logger } from '@nestjs/common';
import Decimal from 'decimal.js';

// ── Filter Configuration ──────────────────────────────────────────────

export interface CopyTradeFilter {
  /** Market cap filter (USD) */
  marketCap: {
    min: number | null;
    max: number | null;
  };

  /** Liquidity filter (USD) */
  liquidity: {
    min: number | null;
    max: number | null;
  };

  /** Token age filter (seconds since creation) */
  tokenAge: {
    min: number | null;
    max: number | null;
  };

  /** Per-address copy amount filter (SOL) */
  copyAmount: {
    min: number | null;
    max: number | null;
  };

  /** Restrict to tokens from specific platforms */
  platform: string[];

  /** Minimum LP burnt ratio (0-1) */
  lpBurntMinRatio: number | null;

  /** Max number of position increases for the same token */
  maxPositionIncreases: number;

  /** Token blacklist (mint addresses) */
  blacklist: string[];

  /** Max acceptable price impact per SOL (0-1 ratio).
   * If 1 SOL of buy creates >X% price increase, the pool is too thin and vulnerable to LPI manipulation. */
  maxPriceImpactPerSol: number | null;
}

export interface TokenFilterContext {
  tokenMint: string;
  /** USD market cap, if known */
  marketCapUsd?: number;
  /** USD liquidity, if known */
  liquidityUsd?: number;
  /** Token age in seconds, if known */
  tokenAgeSecs?: number;
  /** Platform: pump.fun, raydium, orca, meteora, etc. */
  platform?: string;
  /** LP burnt ratio 0-1, if known */
  lpBurntRatio?: number;
  /** SOL amount per address buying */
  solAmountPerAddress?: number;
  /** Number of existing position increases for this token */
  positionIncreaseCount?: number;
  /** Estimated price impact of this trade as ratio (0-1).
   * Computed as (tradeAmountUsd / liquidityUsd) — x-y AMM approximation. */
  estimatedPriceImpact?: number;
}

export interface FilterResult {
  passes: boolean;
  reason?: string;
}

// ── Default Filter ────────────────────────────────────────────────────

export const DEFAULT_COPY_TRADE_FILTER: CopyTradeFilter = {
  marketCap: { min: null, max: null },
  liquidity: { min: 10000, max: null },
  tokenAge: { min: 60, max: null },
  copyAmount: { min: 0.1, max: 50 },
  platform: [],
  lpBurntMinRatio: null,
  maxPositionIncreases: 3,
  blacklist: [],
  maxPriceImpactPerSol: 0.05, // Reject if 1 SOL would move price > 5% — pool too thin for safe entry
};

// ── Filter Logic ──────────────────────────────────────────────────────

const logger = new Logger('CopyTradeFilter');

/**
 * Apply all copy trade filter conditions to a token.
 * Returns { passes: true } if all conditions pass, or { passes: false, reason: '...' } on first failure.
 */
export function applyCopyTradeFilter(
  filter: CopyTradeFilter,
  ctx: TokenFilterContext,
): FilterResult {
  // 1. Blacklist check
  if (filter.blacklist.length > 0 && filter.blacklist.includes(ctx.tokenMint)) {
    return { passes: false, reason: `Token ${ctx.tokenMint.slice(0, 8)}... is blacklisted` };
  }

  // 2. Market cap check
  if (ctx.marketCapUsd !== undefined) {
    if (filter.marketCap.min !== null && ctx.marketCapUsd < filter.marketCap.min) {
      return {
        passes: false,
        reason: `Market cap $${ctx.marketCapUsd.toFixed(0)} < min $${filter.marketCap.min}`,
      };
    }
    if (filter.marketCap.max !== null && ctx.marketCapUsd > filter.marketCap.max) {
      return {
        passes: false,
        reason: `Market cap $${ctx.marketCapUsd.toFixed(0)} > max $${filter.marketCap.max}`,
      };
    }
  }

  // 3. Liquidity check
  if (ctx.liquidityUsd !== undefined) {
    if (filter.liquidity.min !== null && ctx.liquidityUsd < filter.liquidity.min) {
      return {
        passes: false,
        reason: `Liquidity $${ctx.liquidityUsd.toFixed(0)} < min $${filter.liquidity.min}`,
      };
    }
    if (filter.liquidity.max !== null && ctx.liquidityUsd > filter.liquidity.max) {
      return {
        passes: false,
        reason: `Liquidity $${ctx.liquidityUsd.toFixed(0)} > max $${filter.liquidity.max}`,
      };
    }
  }

  // 4. Token age check
  if (ctx.tokenAgeSecs !== undefined) {
    if (filter.tokenAge.min !== null && ctx.tokenAgeSecs < filter.tokenAge.min) {
      return {
        passes: false,
        reason: `Token age ${ctx.tokenAgeSecs}s < min ${filter.tokenAge.min}s`,
      };
    }
    if (filter.tokenAge.max !== null && ctx.tokenAgeSecs > filter.tokenAge.max) {
      return {
        passes: false,
        reason: `Token age ${ctx.tokenAgeSecs}s > max ${filter.tokenAge.max}s`,
      };
    }
  }

  // 5. Copy amount check (per address SOL amount)
  if (ctx.solAmountPerAddress !== undefined) {
    if (filter.copyAmount.min !== null && ctx.solAmountPerAddress < filter.copyAmount.min) {
      return {
        passes: false,
        reason: `Copy amount ${ctx.solAmountPerAddress.toFixed(2)} SOL < min ${filter.copyAmount.min} SOL`,
      };
    }
    if (filter.copyAmount.max !== null && ctx.solAmountPerAddress > filter.copyAmount.max) {
      return {
        passes: false,
        reason: `Copy amount ${ctx.solAmountPerAddress.toFixed(2)} SOL > max ${filter.copyAmount.max} SOL — possible bait`,
      };
    }
  }

  // 6. Platform filter
  if (filter.platform.length > 0 && ctx.platform) {
    const platformLower = ctx.platform.toLowerCase();
    const allowed = filter.platform.map((p) => p.toLowerCase());
    if (!allowed.includes(platformLower)) {
      return {
        passes: false,
        reason: `Platform '${ctx.platform}' not in allowed list: [${filter.platform.join(', ')}]`,
      };
    }
  }

  // 7. LP burnt ratio
  if (
    filter.lpBurntMinRatio !== null &&
    ctx.lpBurntRatio !== undefined &&
    ctx.lpBurntRatio < filter.lpBurntMinRatio
  ) {
    return {
      passes: false,
      reason: `LP burnt ${(ctx.lpBurntRatio * 100).toFixed(1)}% < min ${(filter.lpBurntMinRatio * 100).toFixed(1)}%`,
    };
  }

  // 8. Position increase limit
  if (
    ctx.positionIncreaseCount !== undefined &&
    ctx.positionIncreaseCount >= filter.maxPositionIncreases
  ) {
    return {
      passes: false,
      reason: `Already increased position ${ctx.positionIncreaseCount} times (max ${filter.maxPositionIncreases})`,
    };
  }

  // 9. LPI (Liquidity Pool Impact) manipulation guard
  // Prevents Cabal attacks where small amounts in thin pools create artificial price spikes.
  // estimatedPriceImpact ≈ tradeAmountUsd / poolLiquidityUsd (x*y=k AMM approximation).
  if (
    filter.maxPriceImpactPerSol !== null &&
    ctx.estimatedPriceImpact !== undefined &&
    ctx.estimatedPriceImpact > filter.maxPriceImpactPerSol
  ) {
    return {
      passes: false,
      reason: `Price impact ${(ctx.estimatedPriceImpact * 100).toFixed(1)}% exceeds max ${(filter.maxPriceImpactPerSol * 100).toFixed(1)}% — pool too thin, possible LPI manipulation`,
    };
  }

  return { passes: true };
}

/**
 * Parse a CopyTradeFilter from a strategy's JSON configuration.
 * Merges with defaults to ensure all fields have sensible values.
 */
export function parseCopyTradeFilter(raw?: Partial<CopyTradeFilter>): CopyTradeFilter {
  if (!raw) return { ...DEFAULT_COPY_TRADE_FILTER };

  return {
    marketCap: {
      min: raw.marketCap?.min ?? DEFAULT_COPY_TRADE_FILTER.marketCap.min,
      max: raw.marketCap?.max ?? DEFAULT_COPY_TRADE_FILTER.marketCap.max,
    },
    liquidity: {
      min: raw.liquidity?.min ?? DEFAULT_COPY_TRADE_FILTER.liquidity.min,
      max: raw.liquidity?.max ?? DEFAULT_COPY_TRADE_FILTER.liquidity.max,
    },
    tokenAge: {
      min: raw.tokenAge?.min ?? DEFAULT_COPY_TRADE_FILTER.tokenAge.min,
      max: raw.tokenAge?.max ?? DEFAULT_COPY_TRADE_FILTER.tokenAge.max,
    },
    copyAmount: {
      min: raw.copyAmount?.min ?? DEFAULT_COPY_TRADE_FILTER.copyAmount.min,
      max: raw.copyAmount?.max ?? DEFAULT_COPY_TRADE_FILTER.copyAmount.max,
    },
    platform: raw.platform ?? DEFAULT_COPY_TRADE_FILTER.platform,
    lpBurntMinRatio: raw.lpBurntMinRatio ?? DEFAULT_COPY_TRADE_FILTER.lpBurntMinRatio,
    maxPositionIncreases:
      raw.maxPositionIncreases ?? DEFAULT_COPY_TRADE_FILTER.maxPositionIncreases,
    blacklist: raw.blacklist ?? DEFAULT_COPY_TRADE_FILTER.blacklist,
    maxPriceImpactPerSol:
      raw.maxPriceImpactPerSol ?? DEFAULT_COPY_TRADE_FILTER.maxPriceImpactPerSol,
  };
}
