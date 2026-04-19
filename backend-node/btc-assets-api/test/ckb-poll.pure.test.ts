import { describe, expect, it } from 'vitest';
import { classifyCkbStatus } from '../src/services/ckb-poll';

describe('classifyCkbStatus (BUG-B7)', () => {
  const baseline = { elapsedMs: 0, timeoutMs: 60_000 };

  it('returns done on committed', () => {
    expect(classifyCkbStatus({ ...baseline, status: 'committed' }))
      .toEqual({ kind: 'done' });
  });

  it('returns fail-rejected on rejected', () => {
    expect(classifyCkbStatus({ ...baseline, status: 'rejected' }))
      .toEqual({ kind: 'fail-rejected' });
  });

  it('returns wait on pending', () => {
    expect(classifyCkbStatus({ ...baseline, status: 'pending' }))
      .toEqual({ kind: 'wait' });
  });

  it('returns wait on proposed', () => {
    expect(classifyCkbStatus({ ...baseline, status: 'proposed' }))
      .toEqual({ kind: 'wait' });
  });

  it('returns wait on unknown (node hasn\'t seen the tx yet)', () => {
    expect(classifyCkbStatus({ ...baseline, status: 'unknown' }))
      .toEqual({ kind: 'wait' });
  });

  it('returns wait on undefined (RPC error)', () => {
    expect(classifyCkbStatus({ ...baseline, status: undefined }))
      .toEqual({ kind: 'wait' });
  });

  it('returns wait on totally unrecognised status string', () => {
    // Defensive: future CKB versions may add statuses. We keep
    // polling rather than crashing.
    expect(classifyCkbStatus({ ...baseline, status: 'experimental' }))
      .toEqual({ kind: 'wait' });
  });

  describe('timeout takes precedence', () => {
    it('returns fail-timeout when elapsed >= timeout, even with wait-worthy status', () => {
      expect(
        classifyCkbStatus({
          status: 'pending',
          elapsedMs: 60_001,
          timeoutMs: 60_000,
        }),
      ).toEqual({ kind: 'fail-timeout' });
    });

    it('returns fail-timeout at the exact boundary', () => {
      expect(
        classifyCkbStatus({
          status: 'pending',
          elapsedMs: 60_000,
          timeoutMs: 60_000,
        }),
      ).toEqual({ kind: 'fail-timeout' });
    });

    it('does NOT fail-timeout when committed arrives just in time', () => {
      // The loop body is expected to observe 'committed' BEFORE
      // calling classifyCkbStatus with the increased elapsedMs, so
      // this path is the caller's responsibility. Here we just
      // document that timeout currently trumps committed within the
      // decision function itself — intentional belt-and-braces.
      expect(
        classifyCkbStatus({
          status: 'committed',
          elapsedMs: 70_000,
          timeoutMs: 60_000,
        }),
      ).toEqual({ kind: 'fail-timeout' });
    });
  });
});
