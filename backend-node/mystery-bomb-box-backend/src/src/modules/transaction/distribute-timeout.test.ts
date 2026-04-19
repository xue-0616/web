import {
  MysteryBoxStatus,
  decideFailDistributeAction,
  hasBlockhashExpired,
} from './distribute-timeout';

describe('decideFailDistributeAction (BUG-M3)', () => {
  it('transitions DISTRIBUTE_INIT to failed', () => {
    const r = decideFailDistributeAction(MysteryBoxStatus.DISTRIBUTE_INIT);
    expect(r.kind).toBe('transition-to-failed');
  });

  it('transitions DISTRIBUTE_PENDING to failed', () => {
    // The critical regression case: before the fix this path was
    // silently dropped, locking user funds forever.
    const r = decideFailDistributeAction(MysteryBoxStatus.DISTRIBUTE_PENDING);
    expect(r.kind).toBe('transition-to-failed');
  });

  it('is a no-op when already DISTRIBUTE_FAILED (idempotent)', () => {
    const r = decideFailDistributeAction(MysteryBoxStatus.DISTRIBUTE_FAILED);
    expect(r.kind).toBe('no-op');
    expect((r as any).reason).toMatch(/already/i);
  });

  it('is a no-op when DISTRIBUTE_CONFIRMED (success raced timeout)', () => {
    const r = decideFailDistributeAction(MysteryBoxStatus.DISTRIBUTE_CONFIRMED);
    expect(r.kind).toBe('no-op');
    expect((r as any).reason).toMatch(/confirmed/i);
  });

  it('returns invalid for pre-distribute states', () => {
    for (const s of [
      MysteryBoxStatus.INIT,
      MysteryBoxStatus.INIT_PENDING,
      MysteryBoxStatus.GRABBING,
      MysteryBoxStatus.GRAB_ENDED,
    ]) {
      expect(decideFailDistributeAction(s).kind).toBe('invalid');
    }
  });
});

describe('hasBlockhashExpired', () => {
  it('returns true once the tx is more than 200 blocks old', () => {
    expect(hasBlockhashExpired(1000n, 1201n)).toBe(true);
  });

  it('returns false when exactly at the validity boundary', () => {
    // Solana keeps blockhash valid for 200 blocks; the tx is still
    // eligible at +200 and only expires strictly past that.
    expect(hasBlockhashExpired(1000n, 1200n)).toBe(false);
  });

  it('returns false when the chain is behind the tx block', () => {
    // Shouldn't happen in practice but the predicate must be safe.
    expect(hasBlockhashExpired(1000n, 500n)).toBe(false);
  });

  it('handles very large bigints without overflow', () => {
    const h = BigInt(Number.MAX_SAFE_INTEGER) * 2n;
    expect(hasBlockhashExpired(h, h + 201n)).toBe(true);
    expect(hasBlockhashExpired(h, h + 200n)).toBe(false);
  });
});
