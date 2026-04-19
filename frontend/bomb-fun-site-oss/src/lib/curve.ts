/**
 * Pure-function bonding-curve math used by Pump.fun-style launchpads.
 *
 * Model: constant-product AMM with a virtual reserve seeded so the
 * first buyer pays a predictable starting price. The Pump.fun
 * parameters (virtualSolReserves=30, virtualTokenReserves=1.073B) are
 * encoded as defaults; deployments can override.
 *
 *   x · y = k                 (classic xy=k)
 *   solIn  → Δtokens = y₀ − (y₀·x₀) / (x₀ + Δsol · (1 - FEE_BP/10_000))
 *   tokenIn→ ΔSOL    = x₀ − (x₀·y₀) / (y₀ + Δtoken · (1 - FEE_BP/10_000))
 *
 * All math uses `bigint` for the reserves (lamports / base units) and
 * `number` only for user-facing display. Callers must NEVER round-trip
 * bigint → number → bigint.
 */

export interface CurveParams {
  /** Virtual SOL reserve in lamports. */
  virtualSol: bigint;
  /** Virtual token reserve in base units (9 decimals typically). */
  virtualToken: bigint;
  /** Real-SOL reserve (grows as people buy). */
  realSol: bigint;
  /** Real-token reserve (shrinks as people buy). */
  realToken: bigint;
  /** Trading fee in basis points. 100 = 1%. */
  feeBps: number;
  /** Graduation threshold — when realSol >= this, the curve graduates. */
  graduationSol: bigint;
}

export const DEFAULT_PARAMS: CurveParams = {
  // Pump.fun mainnet defaults (approx).
  virtualSol: 30_000_000_000n,           // 30 SOL in lamports
  virtualToken: 1_073_000_000_000_000n,  // 1.073B tokens * 1e6 decimals
  realSol: 0n,
  realToken: 793_000_000_000_000n,       // 793M initially
  feeBps: 100,                           // 1%
  graduationSol: 85_000_000_000n,        // 85 SOL graduation
};

/** Effective reserves = real + virtual (classic seeded xy=k trick). */
export function effectiveReserves(p: CurveParams): { x: bigint; y: bigint } {
  return { x: p.virtualSol + p.realSol, y: p.virtualToken + p.realToken };
}

/** Spot price = x/y (SOL per token, in lamports / base-unit). */
export function spotPrice(p: CurveParams): number {
  const { x, y } = effectiveReserves(p);
  if (y === 0n) return Infinity;
  // lamports-per-base-unit → SOL-per-token (both denominated the same way,
  // so the ratio is decimals-free). Use number here only for display.
  return Number(x) / Number(y);
}

export interface BuyQuote {
  tokensOut: bigint;
  solInAfterFee: bigint;
  feeLamports: bigint;
  priceImpactPct: number;
  postSpot: number;
}

export function quoteBuy(p: CurveParams, solIn: bigint): BuyQuote {
  if (solIn <= 0n) throw new Error("solIn must be positive");
  const fee = (solIn * BigInt(p.feeBps)) / 10_000n;
  const solInAfterFee = solIn - fee;
  const { x, y } = effectiveReserves(p);
  const k = x * y;
  const newX = x + solInAfterFee;
  const newY = k / newX; // floor division — fee for house
  const tokensOut = y - newY;
  if (tokensOut > p.realToken) {
    throw new Error("insufficient token reserve — buy exceeds launch supply");
  }
  const spotBefore = Number(x) / Number(y);
  const spotAfter = Number(newX) / Number(newY);
  const impact = Math.abs(spotAfter - spotBefore) / spotBefore;
  return {
    tokensOut,
    solInAfterFee,
    feeLamports: fee,
    priceImpactPct: impact * 100,
    postSpot: spotAfter,
  };
}

export interface SellQuote {
  solOut: bigint;
  feeLamports: bigint;
  priceImpactPct: number;
  postSpot: number;
}

export function quoteSell(p: CurveParams, tokenIn: bigint): SellQuote {
  if (tokenIn <= 0n) throw new Error("tokenIn must be positive");
  const { x, y } = effectiveReserves(p);
  const k = x * y;
  const newY = y + tokenIn;
  const newX = k / newY;
  if (newX >= x) throw new Error("sell produces no SOL (curve empty)");
  const grossSol = x - newX;
  const fee = (grossSol * BigInt(p.feeBps)) / 10_000n;
  const solOut = grossSol - fee;
  if (solOut > p.realSol) {
    throw new Error("insufficient real-SOL reserve — sell exceeds liquidity");
  }
  const spotBefore = Number(x) / Number(y);
  const spotAfter = Number(newX) / Number(newY);
  const impact = Math.abs(spotAfter - spotBefore) / spotBefore;
  return { solOut, feeLamports: fee, priceImpactPct: impact * 100, postSpot: spotAfter };
}

/**
 * Cumulative tokens sold → bonding-curve progression. Returns a
 * number 0..1 used by the UI to draw the "raised" bar.
 */
export function progressToGraduation(p: CurveParams): number {
  if (p.graduationSol <= 0n) return 0;
  const frac = Number(p.realSol) / Number(p.graduationSol);
  return Math.max(0, Math.min(1, frac));
}

/** Human display: lamports → "1.23456 SOL". */
export function lamportsToSol(lamports: bigint, precision = 9): string {
  const sol = Number(lamports) / 1e9;
  return sol.toFixed(precision).replace(/0+$/, "").replace(/\.$/, "");
}

/** Clean short address like `Tok1…xY9z`. */
export function shortMint(mint: string): string {
  return mint.length <= 12 ? mint : `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}
