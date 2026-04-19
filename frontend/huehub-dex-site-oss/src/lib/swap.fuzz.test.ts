import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { TOKENS, quote, minOut, buildExecutePlan, verifyFill, MAX_SLIPPAGE_BPS } from "./swap";

/**
 * Property-based fuzzing for the swap safety math.
 *
 * `swap.test.ts` locks in concrete values; this file locks in the
 * invariants that every caller silently depends on (slippage floor
 * never exceeds outAmount, verifyFill never passes a short-fill, …).
 */

const SOL = TOKENS[0];
const USDC = TOKENS[1];

const amountArb = fc.integer({ min: 1, max: 1_000_000_000_000 }).map((n) => BigInt(n));
const slippageArb = fc.integer({ min: 0, max: MAX_SLIPPAGE_BPS });

describe("swap fuzz: invariants", () => {
  it("minOut is always in [0, outAmount]", () => {
    fc.assert(
      fc.property(amountArb, slippageArb, (amt, bps) => {
        const q = { ...quote(SOL, USDC, amt), slippageBps: bps };
        const m = minOut(q);
        expect(m >= 0n).toBe(true);
        expect(m <= q.outAmount).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("verifyFill accepts exactly minOut and anything above", () => {
    fc.assert(
      fc.property(amountArb, slippageArb, (amt, bps) => {
        const q = { ...quote(SOL, USDC, amt), slippageBps: bps };
        // `buildExecutePlan` throws for high-impact — we need a plan
        // so loosen the tolerance to 100% here.
        const plan = buildExecutePlan(q, 100);
        expect(() => verifyFill(plan, plan.minOut)).not.toThrow();
        expect(() => verifyFill(plan, plan.minOut + 1n)).not.toThrow();
        if (plan.minOut > 0n) {
          expect(() => verifyFill(plan, plan.minOut - 1n)).toThrow(/short-changed/);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("quote.outAmount is monotonic in inAmount (within a single pair)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500_000_000_000 }),
        fc.integer({ min: 1, max: 500_000_000_000 }),
        (a, b) => {
          if (a === b) return; // strict monotonicity requires distinct inputs
          const small = BigInt(Math.min(a, b));
          const large = BigInt(Math.max(a, b));
          const qs = quote(SOL, USDC, small).outAmount;
          const ql = quote(SOL, USDC, large).outAmount;
          expect(ql >= qs).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
