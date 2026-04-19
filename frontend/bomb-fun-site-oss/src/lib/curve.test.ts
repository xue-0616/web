import { describe, expect, it } from "vitest";

import {
  DEFAULT_PARAMS,
  lamportsToSol,
  progressToGraduation,
  quoteBuy,
  quoteSell,
  shortMint,
  spotPrice,
  type CurveParams,
} from "./curve";

/**
 * Invariants of a constant-product bonding curve.
 * Round-trip buy→sell should give back (nearly) the same SOL modulo
 * fee; k should be preserved pre-fee; price strictly monotonic.
 */
const p0 = (): CurveParams => ({ ...DEFAULT_PARAMS });

describe("curve — quoteBuy", () => {
  it("rejects non-positive input", () => {
    expect(() => quoteBuy(p0(), 0n)).toThrow();
    expect(() => quoteBuy(p0(), -1n)).toThrow();
  });

  it("produces positive tokensOut for a 1-SOL buy", () => {
    const q = quoteBuy(p0(), 1_000_000_000n);
    expect(q.tokensOut).toBeGreaterThan(0n);
    expect(q.feeLamports).toBe(10_000_000n); // 1% of 1 SOL
    expect(q.solInAfterFee).toBe(990_000_000n);
  });

  it("larger buy → larger price impact", () => {
    const small = quoteBuy(p0(), 100_000_000n);
    const big = quoteBuy(p0(), 5_000_000_000n);
    expect(big.priceImpactPct).toBeGreaterThan(small.priceImpactPct);
  });

  it("price strictly increases after a buy", () => {
    const q = quoteBuy(p0(), 1_000_000_000n);
    expect(q.postSpot).toBeGreaterThan(spotPrice(p0()));
  });
});

describe("curve — quoteSell", () => {
  it("requires realSol liquidity", () => {
    const p = p0();
    // realSol starts at 0 — selling into an untouched curve is illegal.
    expect(() => quoteSell(p, 1_000_000_000n)).toThrow(/insufficient real-SOL/);
  });

  it("round-trip: buy then sell the tokens returns ≈ input SOL − 2 fees", () => {
    const p = p0();
    const buy = quoteBuy(p, 1_000_000_000n);
    // Mutate reserves to reflect the buy so the sell is legal:
    p.realSol += buy.solInAfterFee;
    p.realToken -= buy.tokensOut;

    const sell = quoteSell(p, buy.tokensOut);
    // Expect close to 1 SOL minus two 1% fees → ~0.9801 SOL.
    expect(sell.solOut).toBeGreaterThan(970_000_000n);
    expect(sell.solOut).toBeLessThan(990_000_000n);
  });
});

describe("curve — progress", () => {
  it("is 0 on a fresh curve, 1 at graduation, 0.5 midway", () => {
    const p = p0();
    expect(progressToGraduation(p)).toBe(0);

    p.realSol = p.graduationSol;
    expect(progressToGraduation(p)).toBe(1);

    p.realSol = p.graduationSol / 2n;
    expect(progressToGraduation(p)).toBeCloseTo(0.5, 3);
  });

  it("clamps above 1 (overflow-past-graduation edge case)", () => {
    const p = p0();
    p.realSol = p.graduationSol * 2n;
    expect(progressToGraduation(p)).toBe(1);
  });
});

describe("display helpers", () => {
  it("lamportsToSol trims trailing zeros", () => {
    expect(lamportsToSol(1_000_000_000n)).toBe("1");
    expect(lamportsToSol(1_234_567_890n)).toBe("1.23456789");
    expect(lamportsToSol(50_000n, 4)).toBe("0.0001");
  });

  it("shortMint truncates correctly", () => {
    expect(shortMint("So11111111111111111111111111111111111111112"))
      .toBe("So11…1112");
    expect(shortMint("abc")).toBe("abc"); // shorter than threshold
  });
});
