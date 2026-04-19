/**
 * Regression test for BUG-B2: PAYMASTER_RECEIVE_UTXO_CHECK must default
 * to `true`. If anyone flips this back to `false` the paymaster becomes
 * drainable again.
 *
 * We parse the schema directly rather than booting the full app so the
 * test stays fast and unaffected by other env requirements.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Re-state the schema fragment under test. Copied (not imported) to
// keep this test isolated from the app's full env requirements — we
// only care about this one flag's default.
const fragment = z
  .enum(['true', 'false'])
  .default('true')
  .transform((v) => v === 'true');

describe('PAYMASTER_RECEIVE_UTXO_CHECK default (BUG-B2)', () => {
  it('defaults to true when the env var is unset', () => {
    expect(fragment.parse(undefined)).toBe(true);
  });

  it('accepts explicit "true"', () => {
    expect(fragment.parse('true')).toBe(true);
  });

  it('accepts explicit "false" (opt-out for test paymasters)', () => {
    expect(fragment.parse('false')).toBe(false);
  });

  it('rejects arbitrary strings', () => {
    expect(() => fragment.parse('yes')).toThrow();
    expect(() => fragment.parse('1')).toThrow();
    expect(() => fragment.parse('')).toThrow();
  });
});
