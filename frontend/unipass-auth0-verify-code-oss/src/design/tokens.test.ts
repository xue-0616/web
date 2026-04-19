import { describe, expect, it } from "vitest";

import { COLORS, RADIUS, SHADOW, SPACE, TEXT, TOKENS_VERSION } from "./tokens";

/**
 * Guard-rails on the brand palette. These tests DO NOT prove the
 * tokens.css file is in sync with tokens.ts (there's no runtime link);
 * they simply fail early if someone renames/removes a key we depend on
 * elsewhere. Sync across the 5 projects is a PR-review concern.
 */

describe("design tokens", () => {
  it("TOKENS_VERSION is a positive integer", () => {
    expect(TOKENS_VERSION).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(TOKENS_VERSION)).toBe(true);
  });

  it("every COLORS value is a valid hex string", () => {
    for (const v of Object.values(COLORS)) {
      expect(v).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it("brand and brand-hover differ", () => {
    expect(COLORS.brand).not.toBe(COLORS.brandHover);
  });

  it("SPACE values grow monotonically", () => {
    const seq = [SPACE.s1, SPACE.s2, SPACE.s3, SPACE.s4, SPACE.s5, SPACE.s6, SPACE.s8, SPACE.s10, SPACE.s12]
      .map((s) => Number.parseFloat(s));
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThan(seq[i - 1]);
    }
  });

  it("TEXT sizes grow from xs → 3xl", () => {
    const order = [TEXT.xs, TEXT.sm, TEXT.base, TEXT.lg, TEXT.xl, TEXT._2xl, TEXT._3xl]
      .map((s) => Number.parseFloat(s));
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });

  it("RADIUS sm < md < lg", () => {
    const r = [RADIUS.sm, RADIUS.md, RADIUS.lg].map((s) => Number.parseFloat(s));
    expect(r[0]).toBeLessThan(r[1]);
    expect(r[1]).toBeLessThan(r[2]);
  });

  it("SHADOW.md is heavier than SHADOW.sm (longer string is a proxy)", () => {
    expect(SHADOW.md.length).toBeGreaterThanOrEqual(SHADOW.sm.length);
  });
});
