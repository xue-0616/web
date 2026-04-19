/**
 * BUG-M3 — pure decision logic for distribute-timeout handling.
 *
 * When the Solana blockhash on a distribute tx expires
 * (`txBlockHeight + 200 < currentBlockHeight`), we need to decide what
 * the final state of the mystery box should be. Before this fix the
 * code silently dropped the timed-out tx, leaving the box in
 * DISTRIBUTE_PENDING forever and user funds locked.
 */

// Keep these enums in sync with
// database/entities/mystery-boxs.entity.ts + grab-mystery-boxs.entity.ts
export enum MysteryBoxStatus {
  INIT = 0,
  INIT_FAILED = 1,
  INIT_PENDING = 2,
  GRABBING = 3,
  GRAB_ENDED = 4,
  DISTRIBUTE_INIT = 5,
  DISTRIBUTE_PENDING = 6,
  DISTRIBUTE_CONFIRMED = 7,
  DISTRIBUTE_FAILED = 8,
}

export type FailDistributeAction =
  | { kind: 'transition-to-failed' }
  | { kind: 'no-op'; reason: string }
  | { kind: 'invalid'; reason: string };

/**
 * Decide what to do with a box whose distribute tx timed out.
 *
 *   - INIT / PENDING distribute → transition to DISTRIBUTE_FAILED
 *   - Already DISTRIBUTE_FAILED → no-op (idempotent)
 *   - Already DISTRIBUTE_CONFIRMED → no-op (the success path
 *     raced us; the tx confirmed just before it expired)
 *   - Any other box state → invalid (operator should investigate)
 */
export function decideFailDistributeAction(
  status: MysteryBoxStatus,
): FailDistributeAction {
  switch (status) {
    case MysteryBoxStatus.DISTRIBUTE_INIT:
    case MysteryBoxStatus.DISTRIBUTE_PENDING:
      return { kind: 'transition-to-failed' };
    case MysteryBoxStatus.DISTRIBUTE_FAILED:
      return { kind: 'no-op', reason: 'already in DISTRIBUTE_FAILED' };
    case MysteryBoxStatus.DISTRIBUTE_CONFIRMED:
      return {
        kind: 'no-op',
        reason: 'distribute confirmed — ignore stale timeout',
      };
    default:
      return {
        kind: 'invalid',
        reason: `unexpected box status ${MysteryBoxStatus[status] ?? status} for distribute-timeout`,
      };
  }
}

/**
 * Returns true when the current Solana block height has moved past the
 * validity window of a transaction with the given recorded block
 * height. The window is 200 blocks per Solana protocol rules; we
 * mirror it here so callers don't need to know the magic number.
 */
export function hasBlockhashExpired(
  txBlockHeight: bigint,
  currentBlockHeight: bigint,
): boolean {
  return txBlockHeight + 200n < currentBlockHeight;
}
