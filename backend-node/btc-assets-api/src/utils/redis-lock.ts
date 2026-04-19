/**
 * Redis-backed distributed lock for cron jobs.
 *
 * BUG-B4 (MEDIUM): both the `retry-missing-transactions` and the
 * `unlock-cells` fastify-cron jobs fire on every running instance.
 * With two or more replicas deployed (the standard production
 * topology) both instances race — resubmitting transactions twice,
 * unlocking the same BTC_TIME_LOCK cells from both sides, etc. The
 * serverless `/unlock-cells` HTTP route already had a bespoke SETNX
 * guard (BA-M1); this helper lifts the same pattern into a reusable
 * wrapper so the in-process cron jobs can adopt it too.
 *
 * Pure / side-effect-isolated: the `redis` argument is the minimal
 * ioredis-like surface we need, which makes the wrapper trivial to
 * unit-test against an in-memory fake (see `redis-lock.pure.test.ts`).
 */

/**
 * The subset of ioredis we actually call. Keeps the helper decoupled
 * from the concrete client so tests and alternative back-ends can
 * substitute a compatible object.
 */
export interface RedisLockClient {
  set(
    key: string,
    value: string,
    mode1: 'EX',
    ttlSec: number,
    mode2: 'NX',
  ): Promise<'OK' | null>;
  del(key: string): Promise<number>;
}

export interface WithLockOpts {
  /** Full redis key (caller responsible for namespacing). */
  key: string;
  /** Expiry in seconds. Safety net in case the holder crashes. */
  ttlSec: number;
  /** Optional hook invoked when the lock is already held elsewhere. */
  onSkip?: (key: string) => void;
}

/**
 * Run `fn` inside a redis-held distributed lock.
 *
 * Behaviour:
 *   - On successful `SET NX`, run `fn` to completion and release the
 *     key (regardless of whether `fn` threw).
 *   - If the key is already held, return `{ acquired: false }`
 *     without running `fn`. Caller decides whether to surface this
 *     as a metric / log.
 *   - Propagates any exception `fn` throws *after* releasing the
 *     lock.
 */
export async function withRedisLock<T>(
  redis: RedisLockClient,
  opts: WithLockOpts,
  fn: () => Promise<T>,
): Promise<{ acquired: true; result: T } | { acquired: false }> {
  const acquired = await redis.set(opts.key, Date.now().toString(), 'EX', opts.ttlSec, 'NX');
  if (acquired !== 'OK') {
    opts.onSkip?.(opts.key);
    return { acquired: false };
  }
  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    // Best-effort release. A rare crash after `fn` completes but
    // before `del` lands will still auto-release via TTL.
    try {
      await redis.del(opts.key);
    } catch {
      /* swallow — TTL will eventually clear */
    }
  }
}
