/**
 * Tests for withRedisLock (BUG-B4).
 *
 * Uses a minimal in-memory fake with SETNX + TTL semantics so we
 * exercise the full code path (including the `finally` release) without
 * a live redis.
 */

import { describe, expect, it, vi } from 'vitest';
import { withRedisLock, type RedisLockClient } from '../src/utils/redis-lock';

function fakeRedis(): RedisLockClient & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async set(key, value, _m1, _ttl, _m2) {
      if (store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
  };
}

describe('withRedisLock (BUG-B4)', () => {
  it('runs fn when the lock is free and releases afterwards', async () => {
    const r = fakeRedis();
    const fn = vi.fn().mockResolvedValue('done');
    const out = await withRedisLock(r, { key: 'k', ttlSec: 10 }, fn);
    expect(out).toEqual({ acquired: true, result: 'done' });
    expect(fn).toHaveBeenCalledOnce();
    expect(r.store.has('k')).toBe(false);
  });

  it('skips fn when the lock is already held and notifies onSkip', async () => {
    const r = fakeRedis();
    r.store.set('k', 'held-by-someone');
    const fn = vi.fn();
    const onSkip = vi.fn();
    const out = await withRedisLock(r, { key: 'k', ttlSec: 10, onSkip }, fn);
    expect(out).toEqual({ acquired: false });
    expect(fn).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledWith('k');
    // Still held by the original owner; we must not have deleted it.
    expect(r.store.get('k')).toBe('held-by-someone');
  });

  it('releases the lock even when fn throws', async () => {
    const r = fakeRedis();
    const boom = new Error('boom');
    await expect(
      withRedisLock(r, { key: 'k', ttlSec: 10 }, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(r.store.has('k')).toBe(false);
  });

  it('does not crash if del itself fails', async () => {
    const r: RedisLockClient & { calls: string[] } = {
      calls: [],
      async set() {
        return 'OK';
      },
      async del() {
        throw new Error('redis down');
      },
    };
    const out = await withRedisLock(r, { key: 'k', ttlSec: 10 }, async () => 1);
    expect(out).toEqual({ acquired: true, result: 1 });
  });

  it('serialises two concurrent callers (only one runs fn)', async () => {
    const r = fakeRedis();
    const fn1 = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('a'), 30)),
    );
    const fn2 = vi.fn().mockResolvedValue('b');
    // Fire both before the first can finish.
    const p1 = withRedisLock(r, { key: 'k', ttlSec: 10 }, fn1);
    const p2 = withRedisLock(r, { key: 'k', ttlSec: 10 }, fn2);
    const [o1, o2] = await Promise.all([p1, p2]);
    // Exactly one acquired.
    const acquired = [o1, o2].filter((x) => x.acquired);
    expect(acquired).toHaveLength(1);
    const skipped = [o1, o2].filter((x) => !x.acquired);
    expect(skipped).toHaveLength(1);
  });
});
