/**
 * BUG-B7 — pure decision logic for polling a CKB tx to confirmation.
 *
 * The old `waitForTranscationConfirmed` recursed forever on network
 * errors and on non-'committed' statuses, with no timeout. A tx
 * rejected by the node would therefore block the bullmq worker
 * indefinitely. This module encodes the state transition so the logic
 * is testable without live RPC.
 */

/**
 * CKB `getTransaction` status. We keep the set open (`| string`) so
 * any node-only value we don't recognise still falls into the safe
 * `wait` path instead of crashing the decision function.
 */
export type CkbTxStatus =
  | 'pending'
  | 'proposed'
  | 'committed'
  | 'rejected'
  | 'unknown'
  | string;

export type PollOutcome =
  /** Tx confirmed — resolve. */
  | { kind: 'done' }
  /** Tx explicitly rejected by the node — fail fast. */
  | { kind: 'fail-rejected' }
  /** We've exceeded the caller-supplied deadline. */
  | { kind: 'fail-timeout' }
  /** Normal in-progress state; caller should sleep and re-poll. */
  | { kind: 'wait' };

export interface ClassifyInput {
  /** The latest `txStatus.status` we observed, or undefined on RPC error. */
  status: CkbTxStatus | undefined;
  /** Milliseconds since the wait began. */
  elapsedMs: number;
  /** Total time budget the caller allows. */
  timeoutMs: number;
}

export function classifyCkbStatus(input: ClassifyInput): PollOutcome {
  // Timeout trumps everything so we never return 'wait' past the
  // deadline. Callers that successfully observed 'committed' on the
  // last tick still finish normally because they short-circuit
  // before calling us with the new elapsed time.
  if (input.elapsedMs >= input.timeoutMs) {
    return { kind: 'fail-timeout' };
  }
  switch (input.status) {
    case 'committed':
      return { kind: 'done' };
    case 'rejected':
      return { kind: 'fail-rejected' };
    // pending / proposed / unknown / undefined (RPC error) → keep
    // polling. `unknown` is the status returned for txs the node
    // hasn't heard of yet, which is common right after broadcast.
    default:
      return { kind: 'wait' };
  }
}

/** Hard defaults used by the CKBClient when the caller doesn't pass
 *  overrides. 10-minute deadline is well past typical CKB finality
 *  (30-60 s) so we only fail when something is genuinely wrong. */
export const DEFAULT_POLL_INTERVAL_MS = 1_000;
export const DEFAULT_POLL_TIMEOUT_MS = 10 * 60 * 1_000;
