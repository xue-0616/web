/**
 * BUG-B3 — partial-failure paymaster cell rollback decision.
 *
 * When processing an rgb++ tx fails after we've acquired a paymaster
 * cell, we have to decide whether to roll the cell back to "unspent"
 * (so another job can use it) or leave it marked "spent". The old
 * code unconditionally rolled back, which corrupted the cell state
 * whenever the CKB tx had already been broadcast — a subsequent job
 * would then try to spend a cell that's actually spent on-chain.
 *
 * This module expresses the three cases as a pure function so the
 * intent is explicit and testable.
 */

export type PaymasterRollbackAction =
  /** Mark the cell as unspent. Only safe when the tx was never broadcast. */
  | 'rollback'
  /** Leave the cell marked spent. Safe when the tx is in CKB mempool. */
  | 'keep-spent'
  /** Nothing to do — the job never acquired a paymaster cell. */
  | 'no-op';

export interface PaymasterRollbackInput {
  /** Did `sendTransaction` return a CKB tx hash? */
  ckbSubmitted: boolean;
  /** Did this particular job need a paymaster cell at all? */
  needPaymasterCell: boolean;
}

export function decidePaymasterCellRollback(
  input: PaymasterRollbackInput,
): PaymasterRollbackAction {
  if (input.ckbSubmitted) {
    // The tx is in CKB mempool. The cell is genuinely spent on-chain
    // (pending confirmation). Keep it marked spent; rolling back
    // would let a future job pick a doomed cell.
    return 'keep-spent';
  }
  if (input.needPaymasterCell) {
    // We acquired a cell but never broadcast the tx. Safe to release
    // so another job can use it.
    return 'rollback';
  }
  return 'no-op';
}
