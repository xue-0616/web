/**
 * Unit tests for decideEnqueueAction (BUG-B1).
 *
 * Exhaustively cover the (jobState × redisValue × setnxWon) decision
 * matrix. The critical regression we're guarding against is the
 * previous code silently falling through to queue.add when the dedup
 * key already held "processing".
 */

import { describe, expect, it } from 'vitest';
import {
  decideEnqueueAction,
  type JobDedupState,
} from '../src/services/transaction-dedup';

describe('decideEnqueueAction (BUG-B1)', () => {
  describe('Rule 1: pre-existing bullmq job wins', () => {
    it.each<[JobDedupState]>([
      ['completed'],
      ['active'],
      ['waiting'],
      ['delayed'],
    ])('reuses existing job in state "%s"', (state) => {
      const r = decideEnqueueAction(state, 'processing', false);
      expect(r.kind).toBe('reuse-existing');
    });

    it('does NOT reuse a failed job (retry is legitimate)', () => {
      const r = decideEnqueueAction('failed', 'failed', true);
      expect(r.kind).toBe('proceed');
    });
  });

  describe('Rule 2: setnx winner proceeds', () => {
    it('proceeds when no prior state and setnx won', () => {
      const r = decideEnqueueAction(undefined, null, true);
      expect(r.kind).toBe('proceed');
    });
  });

  describe('Rule 3: setnx loser blocks on live state', () => {
    it('blocks on "processing" — the canonical race window (the BUG)', () => {
      const r = decideEnqueueAction(undefined, 'processing', false);
      expect(r.kind).toBe('block');
      expect((r as any).reason).toMatch(/currently processing/);
    });

    it('blocks on "completed"', () => {
      const r = decideEnqueueAction(undefined, 'completed', false);
      expect(r.kind).toBe('block');
      expect((r as any).reason).toMatch(/already completed/);
    });

    it('blocks on "completed:<ckbHash>" suffix variant', () => {
      const r = decideEnqueueAction(
        undefined,
        'completed:0xabc123',
        false,
      );
      expect(r.kind).toBe('block');
    });

    it('permits retry on "failed"', () => {
      const r = decideEnqueueAction(undefined, 'failed', false);
      expect(r.kind).toBe('proceed');
    });

    it('blocks on unknown value', () => {
      const r = decideEnqueueAction(undefined, 'something-weird', false);
      expect(r.kind).toBe('block');
      expect((r as any).reason).toMatch(/unknown/);
    });

    it('blocks on inconsistent redis (setnx=false but value=null)', () => {
      const r = decideEnqueueAction(undefined, null, false);
      expect(r.kind).toBe('block');
    });
  });

  describe('interaction matrix', () => {
    it('bullmq-job check takes priority over redis value', () => {
      // Even though redisValue claims "processing", a completed bullmq
      // job is authoritative and we return the existing job.
      const r = decideEnqueueAction('completed', 'processing', false);
      expect(r.kind).toBe('reuse-existing');
    });

    it('no bullmq job + setnx winner + stale redis cleanup scenario', () => {
      // If a previous run failed and cleaned up its job, a retry
      // wins setnx and can proceed. This is the expected retry path.
      const r = decideEnqueueAction(undefined, null, true);
      expect(r.kind).toBe('proceed');
    });
  });
});
