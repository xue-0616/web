/**
 * RGB++ transaction dedup decision logic.
 *
 * BUG-B1 (HIGH): the existing `enqueueTransaction` merged two checks
 * (bullmq job state + redis SETNX idempotency key) but left a race
 * window open: when redis SETNX returned "key exists" and the stored
 * value was *not* the literal string "completed", execution fell
 * through to `queue.add()` anyway — letting a second submission race
 * past the first one into the queue.
 *
 * This module extracts the decision table into a pure function so it
 * can be tested exhaustively without spinning up redis + bullmq.
 */

/** BullMQ job state we care about for dedup. `undefined` means "no job". */
export type JobDedupState =
  | 'completed'
  | 'active'
  | 'waiting'
  | 'delayed'
  | 'failed'
  | 'unknown'
  | undefined;

/**
 * Literal value stored in the redis dedup key. We accept any string;
 * the ones we currently emit are listed on DedupValue for clarity.
 */
export type DedupValue =
  | 'processing'
  | 'completed'
  | `completed:${string}` // may include the resulting ckb tx hash
  | 'failed'
  | string // future-proof
  | null; // key absent

export type EnqueueAction =
  /** Return the existing bullmq job; don't add a new one. */
  | { kind: 'reuse-existing'; reason: string }
  /** Refuse the request outright; the caller sees an error. */
  | { kind: 'block'; reason: string }
  /** No prior state blocks us; proceed to `queue.add(...)`. */
  | { kind: 'proceed' };

/**
 * Decide what to do with an incoming enqueue request, given:
 *   - `jobState`: the state of any pre-existing bullmq job for this
 *     txid (or undefined if none).
 *   - `redisValue`: the value of the redis dedup key, or null if
 *     missing.
 *   - `setnxWon`: true iff the caller just won a `SET NX` race on the
 *     redis dedup key (it just atomically created it).
 *
 * Rules (in priority order):
 *   1. If a bullmq job exists in `completed|active|waiting|delayed`
 *      state, reuse it. These are normal in-flight / just-finished
 *      states and double-add would be silently deduped by bullmq
 *      anyway, but we surface the intent explicitly.
 *   2. If `setnxWon` is true the caller owns the request. Proceed.
 *   3. Otherwise the redis key already existed. Check its value:
 *        - "processing" / "completed" / "completed:*" → block.
 *          A concurrent submission is already in flight or the tx has
 *          already succeeded. Re-running it risks double-spend.
 *        - "failed" → proceed. An operator explicitly marked the tx
 *          re-eligible; the bullmq job check above has already
 *          cleared the `failed` state as non-blocking.
 *        - null → should not happen (setnxWon=false implies the key
 *          was set), but if it does, treat as unknown and block
 *          conservatively.
 *        - anything else → block. Unknown values are treated as
 *          hostile; the operator must investigate.
 */
export function decideEnqueueAction(
  jobState: JobDedupState,
  redisValue: DedupValue,
  setnxWon: boolean,
): EnqueueAction {
  // Rule 1 — reuse in-flight / completed bullmq job
  if (
    jobState === 'completed' ||
    jobState === 'active' ||
    jobState === 'waiting' ||
    jobState === 'delayed'
  ) {
    return {
      kind: 'reuse-existing',
      reason: `bullmq job already in state "${jobState}"`,
    };
  }

  // Rule 2 — we just won the SETNX race
  if (setnxWon) {
    return { kind: 'proceed' };
  }

  // Rule 3 — redis key was pre-existing, decide on its value
  if (redisValue === null || redisValue === undefined) {
    return {
      kind: 'block',
      reason: 'setnx reported key exists but value missing — inconsistent redis state',
    };
  }
  if (redisValue === 'processing') {
    return {
      kind: 'block',
      reason: 'another submission is currently processing this txid',
    };
  }
  if (redisValue === 'completed' || redisValue.startsWith('completed:')) {
    return {
      kind: 'block',
      reason: 'transaction has already completed — refusing to re-submit',
    };
  }
  if (redisValue === 'failed') {
    // The prior run failed; allow retry. The bullmq job (if any) is
    // in 'failed' state which was not caught by Rule 1.
    return { kind: 'proceed' };
  }
  return {
    kind: 'block',
    reason: `unknown dedup value "${redisValue}" — refusing to proceed`,
  };
}
