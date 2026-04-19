/**
 * Token pair + Jupiter-style quote shape, kept pure-functional so we
 * can swap in the real `@jup-ag/api` client without touching the UI.
 */
export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;  // emoji as a stand-in; real deploy uses CDN URL
  priceUsd: number;
}

export const TOKENS: TokenInfo[] = [
  { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", decimals: 9, logo: "◎", priceUsd: 187.50 },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", decimals: 6, logo: "💵", priceUsd: 1.0 },
  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether", decimals: 6, logo: "💴", priceUsd: 0.999 },
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter", decimals: 6, logo: "🪐", priceUsd: 1.23 },
  { mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", symbol: "JTO", name: "Jito", decimals: 9, logo: "⚡", priceUsd: 3.45 },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", decimals: 5, logo: "🐕", priceUsd: 0.0000247 },
];

export interface Quote {
  inAmount: bigint;
  outAmount: bigint;
  priceImpactPct: number;
  route: string[];
  slippageBps: number;
}

/**
 * Mock quote — uses USD price × amount for a round-number outAmount,
 * then applies a synthetic 0.3% impact for amounts > 1% of nominal
 * liquidity so the price-impact pill is exercised.
 */
export function quote(from: TokenInfo, to: TokenInfo, inAmount: bigint, slippageBps = 50): Quote {
  if (inAmount <= 0n) throw new Error("amount must be positive");
  const inUsd = (Number(inAmount) / 10 ** from.decimals) * from.priceUsd;
  const outTokens = inUsd / to.priceUsd;
  const outAmount = BigInt(Math.floor(outTokens * 10 ** to.decimals));
  // Synthetic impact: worse for bigger trades (log-scaled).
  const impact = Math.min(5, Math.log10(Math.max(1, inUsd / 1000)) * 0.3);
  const impactFactor = 1 - impact / 100;
  const adjusted = BigInt(Math.floor(Number(outAmount) * impactFactor));
  const route =
    from.symbol === "SOL" || to.symbol === "SOL"
      ? [from.symbol, to.symbol]
      : [from.symbol, "SOL", to.symbol];
  return { inAmount, outAmount: adjusted, priceImpactPct: impact, route, slippageBps };
}

export function formatTokens(n: bigint, decimals: number, precision = 6): string {
  const v = Number(n) / 10 ** decimals;
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v.toFixed(precision).replace(/0+$/, "").replace(/\.$/, "");
}

export function parseTokenAmount(input: string, decimals: number): bigint {
  const n = Number.parseFloat(input);
  if (!Number.isFinite(n) || n <= 0) throw new Error("bad amount");
  return BigInt(Math.floor(n * 10 ** decimals));
}

// ─── safety rails ────────────────────────────────────────────────────────────

/**
 * Bands that map to the three states a UI should visually distinguish.
 *   - ok     : < 1% impact, normal green
 *   - warn   : 1–5%, amber, require an extra click
 *   - danger : > 5%, red, require typed confirmation
 *
 * These thresholds match what Jupiter's front-end uses today.
 */
export type ImpactBand = "ok" | "warn" | "danger";

export function impactBand(priceImpactPct: number): ImpactBand {
  if (priceImpactPct < 1) return "ok";
  if (priceImpactPct < 5) return "warn";
  return "danger";
}

/** Hard upper bound on user-selectable slippage (10%). Anything above would
 *  be cheaper to accept as an MEV tip than a slippage allowance. */
export const MAX_SLIPPAGE_BPS = 1000;

export function assertSlippage(bps: number): void {
  if (!Number.isFinite(bps) || bps < 0) throw new Error("slippage must be >= 0");
  if (bps > MAX_SLIPPAGE_BPS) throw new Error(`slippage cap exceeded (max ${MAX_SLIPPAGE_BPS}bps = 10%)`);
}

/**
 * Minimum output the executor is allowed to settle for. Any on-chain
 * outcome < this value MUST revert the swap, otherwise a sandwicher can
 * drain the user to an effectively-zero outAmount.
 *
 * Formula: `outAmount * (1 - slippage)` rounded DOWN to integer.
 */
export function minOut(q: Quote): bigint {
  assertSlippage(q.slippageBps);
  // Use BigInt math throughout so we don't lose precision on big trades.
  const keep = 10_000n - BigInt(q.slippageBps);
  return (q.outAmount * keep) / 10_000n;
}

export interface ExecutePlan {
  quote: Quote;
  minOut: bigint;
  impactBand: ImpactBand;
}

/**
 * Build the final executable plan from a quote + user-allowed max impact.
 * Throws if the quote's price impact exceeds the user's tolerance so the
 * UI can surface a typed confirmation dialog.
 */
export function buildExecutePlan(q: Quote, userMaxImpactPct = 5): ExecutePlan {
  if (q.priceImpactPct > userMaxImpactPct) {
    throw new Error(
      `price impact ${q.priceImpactPct.toFixed(2)}% exceeds tolerance ${userMaxImpactPct}% — cancel or raise`,
    );
  }
  return { quote: q, minOut: minOut(q), impactBand: impactBand(q.priceImpactPct) };
}

/**
 * Post-settlement check — run this on the `outAmount` returned by the
 * Solana tx receipt. Throws if the fill was worse than the floor, which
 * should trigger the indexer to flag the tx for review.
 */
export function verifyFill(plan: ExecutePlan, actualOut: bigint): void {
  if (actualOut < plan.minOut) {
    throw new Error(
      `fill short-changed: got ${actualOut}, minimum was ${plan.minOut} (${plan.quote.slippageBps}bps slippage)`,
    );
  }
}
