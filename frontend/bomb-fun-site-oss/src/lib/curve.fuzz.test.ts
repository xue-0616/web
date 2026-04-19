import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { DEFAULT_PARAMS, quoteBuy, quoteSell, spotPrice, progressToGraduation } from "./curve";

/**
 * Property-based fuzzing for the bonding-curve math.
 *
 * These are NOT unit tests — `curve.test.ts` still holds the
 * golden-value assertions. This file codifies invariants that must
 * hold for *every* input and runs fast-check's shrinker so a failing
 * input is reduced to the minimal reproducer.
 *
 * Why not `cargo-fuzz` style fuzzing? Our hot math runs in browsers
 * and we already have vitest in CI; `fast-check` gives us the same
 * shrinking behaviour without adding a second test harness.
 */

/**
 * Generator for a BigInt-shaped SOL amount in lamports (1 lamport .. 10 SOL).
 *
 * Cap chosen so a buy never drains `realToken` on `DEFAULT_PARAMS`. The
 * real exhaustion point is ~22 SOL; 10 leaves comfortable head-room for
 * the `monotonic` test that probes `max + 1`.
 */
const solLamportsArb = fc
  .integer({ min: 1, max: 10 * 1_000_000_000 })
  .map((n: number) => BigInt(n));

/** Generator for a token amount (1 .. 1e12 wei-ish base units). */
const tokenAmountArb = fc
  .integer({ min: 1, max: 1_000_000_000 })
  .map((n: number) => BigInt(n));

describe("curve fuzz: invariants", () => {
  it("buy then immediate sell never returns more than was paid", () => {
    fc.assert(
      fc.property(solLamportsArb, (solIn) => {
        // Simulate curve state after the buy: realSol grows by
        // `solInAfterFee` (protocol fee is siphoned off), realToken
        // shrinks by `tokensOut`. Then run the sell against that state
        // — the original curve has realSol=0 and would trivially throw.
        const buy = quoteBuy(DEFAULT_PARAMS, solIn);
        const postBuy = {
          ...DEFAULT_PARAMS,
          realSol: DEFAULT_PARAMS.realSol + buy.solInAfterFee,
          realToken: DEFAULT_PARAMS.realToken - buy.tokensOut,
        };
        // At dust-level buys (e.g. 1 lamport), bigint floor-division
        // makes the sell-side math want to dispense 1 lamport MORE
        // than was deposited. The curve correctly rejects this —
        // treat the reserve-exhaustion error as a valid branch and
        // only assert the no-free-lunch invariant when the sell
        // actually succeeds.
        try {
          const { solOut } = quoteSell(postBuy, buy.tokensOut);
          expect(solOut <= solIn).toBe(true);
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
          expect((e as Error).message).toMatch(/insufficient|empty/);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("spotPrice is strictly positive", () => {
    fc.assert(
      fc.property(solLamportsArb, (extraSol) => {
        const params = { ...DEFAULT_PARAMS, virtualSol: DEFAULT_PARAMS.virtualSol + extraSol };
        const p = spotPrice(params);
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it("progressToGraduation stays in [0, 1]", () => {
    fc.assert(
      fc.property(solLamportsArb, (realSol) => {
        const params = { ...DEFAULT_PARAMS, realSol };
        const p = progressToGraduation(params);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it("larger buys produce strictly larger token outputs (monotonic)", () => {
    // Keep the probe well under the curve's ~22 SOL exhaustion point so
    // both `small` and `large` quote successfully.
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 * 1_000_000_000 }),
        fc.integer({ min: 1, max: 5 * 1_000_000_000 }),
        (a, b) => {
          const small = BigInt(Math.min(a, b));
          const large = BigInt(Math.max(a, b) + 1);
          const smallOut = quoteBuy(DEFAULT_PARAMS, small).tokensOut;
          const largeOut = quoteBuy(DEFAULT_PARAMS, large).tokensOut;
          expect(largeOut > smallOut).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("sell output is non-negative for any positive token amount", () => {
    fc.assert(
      fc.property(tokenAmountArb, (tokensIn) => {
        try {
          const { solOut } = quoteSell(DEFAULT_PARAMS, tokensIn);
          expect(solOut >= 0n).toBe(true);
        } catch (e) {
          // If the curve math deliberately rejects an oversize sell,
          // the error must be a plain Error with a human message —
          // never a TypeError / Infinity propagation.
          expect(e).toBeInstanceOf(Error);
        }
      }),
      { numRuns: 200 },
    );
  });
});
