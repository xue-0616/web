/**
 * Unit tests for validateBoxParams.
 *
 * These cover the HIGH severity BUG-M1 + MEDIUM BUG-M5 from
 * BUSINESS_LOGIC_AUDIT.md and protect against regressions.
 */

import {
  LAMPORTS_PER_SOL,
  MAX_BOX_SOL,
  MIN_BOX_SOL,
  validateBoxParams,
} from './validators';

describe('validateBoxParams', () => {
  const TOTAL = 100;

  describe('amount validation (BUG-M1)', () => {
    it('rejects zero', () => {
      const v = validateBoxParams(0, 5, TOTAL);
      expect(v.ok).toBe(false);
      expect(v.reason).toMatch(/amount must be within/);
    });

    it('rejects negative amounts', () => {
      const v = validateBoxParams(-1, 5, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('rejects dust below MIN_BOX_SOL', () => {
      const v = validateBoxParams(MIN_BOX_SOL - 1e-9, 5, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('rejects values above MAX_BOX_SOL', () => {
      const v = validateBoxParams(MAX_BOX_SOL + 1, 5, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('rejects NaN', () => {
      const v = validateBoxParams(Number.NaN, 5, TOTAL);
      expect(v.ok).toBe(false);
      expect(v.reason).toMatch(/finite number/);
    });

    it('rejects Infinity', () => {
      const v = validateBoxParams(Number.POSITIVE_INFINITY, 5, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('rejects non-numeric amount', () => {
      const v = validateBoxParams('1' as unknown as number, 5, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('accepts exactly MIN_BOX_SOL', () => {
      const v = validateBoxParams(MIN_BOX_SOL, 5, TOTAL);
      expect(v.ok).toBe(true);
      expect(v.lamports).toBe(BigInt(Math.round(MIN_BOX_SOL * LAMPORTS_PER_SOL)));
    });

    it('accepts exactly MAX_BOX_SOL', () => {
      const v = validateBoxParams(MAX_BOX_SOL, 5, TOTAL);
      expect(v.ok).toBe(true);
    });

    it('accepts typical 0.5 SOL', () => {
      const v = validateBoxParams(0.5, 5, TOTAL);
      expect(v.ok).toBe(true);
      expect(v.lamports).toBe(BigInt(LAMPORTS_PER_SOL / 2));
    });
  });

  describe('bombNumber validation (BUG-M5)', () => {
    it('rejects negative slot', () => {
      const v = validateBoxParams(0.5, -1, TOTAL);
      expect(v.ok).toBe(false);
      expect(v.reason).toMatch(/bombNumber/);
    });

    it('rejects slot == totalBoxCount (out of range)', () => {
      const v = validateBoxParams(0.5, TOTAL, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('rejects slot > totalBoxCount (impossible bomb)', () => {
      const v = validateBoxParams(0.5, TOTAL + 1, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('rejects non-integer slot', () => {
      const v = validateBoxParams(0.5, 1.5, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('rejects NaN slot', () => {
      const v = validateBoxParams(0.5, Number.NaN, TOTAL);
      expect(v.ok).toBe(false);
    });

    it('accepts slot 0', () => {
      expect(validateBoxParams(0.5, 0, TOTAL).ok).toBe(true);
    });

    it('accepts last valid slot', () => {
      expect(validateBoxParams(0.5, TOTAL - 1, TOTAL).ok).toBe(true);
    });
  });

  describe('totalBoxCount validation', () => {
    it('rejects zero capacity', () => {
      expect(validateBoxParams(0.5, 0, 0).ok).toBe(false);
    });

    it('rejects negative capacity', () => {
      expect(validateBoxParams(0.5, 0, -1).ok).toBe(false);
    });

    it('rejects non-integer capacity', () => {
      expect(validateBoxParams(0.5, 0, 1.5).ok).toBe(false);
    });
  });

  describe('lamport rounding', () => {
    it('rounds rather than truncates', () => {
      // 0.0012345 SOL = 1_234_500 lamports
      const v = validateBoxParams(0.0012345, 0, TOTAL);
      expect(v.ok).toBe(true);
      expect(v.lamports).toBe(1_234_500n);
    });

    it('handles MAX_BOX_SOL without overflow', () => {
      const v = validateBoxParams(MAX_BOX_SOL, 0, TOTAL);
      expect(v.ok).toBe(true);
      // 1000 SOL = 10^12 lamports, well inside MAX_SAFE_INTEGER
      expect(v.lamports).toBe(BigInt(MAX_BOX_SOL) * BigInt(LAMPORTS_PER_SOL));
    });
  });
});
