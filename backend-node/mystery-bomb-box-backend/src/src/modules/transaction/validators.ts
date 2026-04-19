/**
 * Pure validators for mystery-box transaction parameters.
 *
 * Kept in a separate file (no NestJS / Solana / DB imports) so they are
 * trivially unit-testable with `jest` without spinning up a full module.
 *
 * Fixes audit findings:
 *   - BUG-M1 (HIGH): box creation allowed amount <= 0 / dust, leaving
 *     the system in a broken state when distribution ran.
 *   - BUG-M5 (MEDIUM): bombNumber was not validated server-side so a
 *     caller could craft an unreachable bomb slot.
 */

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Minimum SOL value we'll accept for a box. Below 0.001 SOL the 1.8x
 *  grab math loses precision and the resulting box is effectively dust. */
export const MIN_BOX_SOL = 0.001;

/** Hard upper bound so a typo doesn't create a whale-sized liability. */
export const MAX_BOX_SOL = 1_000;

export interface BoxParamValidation {
  /** true when every check passed. */
  ok: boolean;
  /** human-readable reason when !ok; undefined when ok. */
  reason?: string;
  /** lamport-equivalent of `amount`, only present when ok. */
  lamports?: bigint;
}

/**
 * Validate the `(amount, bombNumber)` pair for a mystery-box create call.
 *
 * @param amount       SOL amount, must be a finite number in [MIN, MAX]
 * @param bombNumber   Integer slot index, must satisfy 0 <= n < totalBoxCount
 * @param totalBoxCount Positive integer capacity of the box
 */
export function validateBoxParams(
  amount: unknown,
  bombNumber: unknown,
  totalBoxCount: number,
): BoxParamValidation {
  if (!Number.isInteger(totalBoxCount) || totalBoxCount <= 0) {
    return { ok: false, reason: 'totalBoxCount must be a positive integer' };
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { ok: false, reason: 'amount must be a finite number' };
  }
  if (amount < MIN_BOX_SOL || amount > MAX_BOX_SOL) {
    return {
      ok: false,
      reason: `amount must be within [${MIN_BOX_SOL}, ${MAX_BOX_SOL}] SOL`,
    };
  }
  if (
    typeof bombNumber !== 'number' ||
    !Number.isInteger(bombNumber) ||
    bombNumber < 0 ||
    bombNumber >= totalBoxCount
  ) {
    return {
      ok: false,
      reason: `bombNumber must be an integer in [0, ${totalBoxCount})`,
    };
  }
  // Round *after* bounds so a giant input can't overflow through the
  // multiplication; MAX_BOX_SOL * LAMPORTS_PER_SOL = 1e12 stays well
  // within Number.MAX_SAFE_INTEGER (~9e15).
  const lamports = BigInt(Math.round(amount * LAMPORTS_PER_SOL));
  return { ok: true, lamports };
}
