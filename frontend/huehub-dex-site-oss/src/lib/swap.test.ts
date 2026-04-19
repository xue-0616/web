import { describe, expect, it } from "vitest";

import {
  TOKENS,
  formatTokens,
  parseTokenAmount,
  quote,
  minOut,
  impactBand,
  assertSlippage,
  buildExecutePlan,
  verifyFill,
  MAX_SLIPPAGE_BPS,
} from "./swap";

const SOL = TOKENS[0];
const USDC = TOKENS[1];
const BONK = TOKENS.find((t) => t.symbol === "BONK")!;

describe("quote", () => {
  it("rejects zero/negative amount", () => {
    expect(() => quote(SOL, USDC, 0n)).toThrow();
    expect(() => quote(SOL, USDC, -1n)).toThrow();
  });

  it("1 SOL → USDC is roughly the SOL USD price", () => {
    const q = quote(SOL, USDC, 1_000_000_000n); // 1 SOL in lamports
    const usdcOut = Number(q.outAmount) / 1e6;
    expect(usdcOut).toBeCloseTo(SOL.priceUsd, 0);
  });

  it("computes a 3-hop route for non-SOL pairs", () => {
    const q = quote(USDC, BONK, 1_000_000n);
    expect(q.route).toEqual(["USDC", "SOL", "BONK"]);
  });

  it("computes a 2-hop route when SOL is one side", () => {
    const q = quote(SOL, USDC, 1_000_000_000n);
    expect(q.route).toEqual(["SOL", "USDC"]);
  });

  it("larger trades get worse price impact", () => {
    const small = quote(SOL, USDC, 1_000_000n);   // tiny
    const big = quote(SOL, USDC, 1_000_000_000_000n);  // 1000 SOL
    expect(big.priceImpactPct).toBeGreaterThan(small.priceImpactPct);
  });
});

describe("display helpers", () => {
  it("formats small amounts with trimmed zeros", () => {
    expect(formatTokens(12_340_000n, 6)).toBe("12.34");
    expect(formatTokens(1_000_000_000n, 9)).toBe("1");
  });

  it("formats large amounts with thousand separators", () => {
    const v = formatTokens(12_345_000_000n, 6);
    // 12345 → localized; accept either "12,345" or "12345" depending on locale
    expect(v.replace(/[,.]/g, "")).toMatch(/^12345/);
  });

  it("parseTokenAmount round-trips against formatTokens", () => {
    const raw = parseTokenAmount("1.5", 9);
    expect(raw).toBe(1_500_000_000n);
  });

  it("parseTokenAmount rejects invalid", () => {
    expect(() => parseTokenAmount("foo", 6)).toThrow();
    expect(() => parseTokenAmount("0", 6)).toThrow();
    expect(() => parseTokenAmount("-5", 6)).toThrow();
  });
});

describe("safety rails", () => {
  it("minOut rounds down and respects slippage bps", () => {
    const q = { ...quote(SOL, USDC, 1_000_000_000n), outAmount: 1_000_000n, slippageBps: 50 };
    // 50 bps = 0.5% → floor(1_000_000 * 9950 / 10000) = 995_000
    expect(minOut(q)).toBe(995_000n);
  });

  it("minOut at 0 bps equals outAmount (no slippage allowed)", () => {
    const q = { ...quote(SOL, USDC, 1_000_000_000n), outAmount: 42n, slippageBps: 0 };
    expect(minOut(q)).toBe(42n);
  });

  it("minOut at max bps floors near-zero", () => {
    const q = { ...quote(SOL, USDC, 1_000_000_000n), outAmount: 1_000_000n, slippageBps: MAX_SLIPPAGE_BPS };
    // 1000 bps → 10% slippage → floor(1_000_000 * 9000 / 10000) = 900_000
    expect(minOut(q)).toBe(900_000n);
  });

  it("rejects slippage above the hard cap", () => {
    expect(() => assertSlippage(MAX_SLIPPAGE_BPS + 1)).toThrow(/cap exceeded/);
    expect(() => assertSlippage(-1)).toThrow(/>= 0/);
    expect(() => assertSlippage(Number.NaN)).toThrow();
  });

  it("impactBand classifies the three ranges", () => {
    expect(impactBand(0.1)).toBe("ok");
    expect(impactBand(0.99)).toBe("ok");
    expect(impactBand(1.0)).toBe("warn");
    expect(impactBand(4.99)).toBe("warn");
    expect(impactBand(5.0)).toBe("danger");
    expect(impactBand(99)).toBe("danger");
  });

  it("buildExecutePlan blocks trades above user's impact tolerance", () => {
    const q = { ...quote(SOL, USDC, 1_000_000_000n), priceImpactPct: 7.5 };
    expect(() => buildExecutePlan(q, 5)).toThrow(/exceeds tolerance/);
  });

  it("buildExecutePlan passes through on ok trades", () => {
    const q = quote(SOL, USDC, 1_000_000n); // small trade, low impact
    const plan = buildExecutePlan(q, 5);
    expect(plan.minOut).toBeLessThanOrEqual(plan.quote.outAmount);
    expect(plan.impactBand).toBe("ok");
  });

  it("verifyFill throws when actual < minOut (sandwich detection)", () => {
    const q = { ...quote(SOL, USDC, 1_000_000_000n), outAmount: 1_000n, slippageBps: 100 };
    const plan = buildExecutePlan(q, 10);
    expect(() => verifyFill(plan, plan.minOut - 1n)).toThrow(/short-changed/);
    expect(() => verifyFill(plan, plan.minOut)).not.toThrow();
    expect(() => verifyFill(plan, plan.minOut + 1n)).not.toThrow();
  });
});
