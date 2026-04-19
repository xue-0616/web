import { describe, expect, it } from "vitest";

import { COPY, type Locale } from "./content";

const LOCALES: Locale[] = ["en", "zh-CN"];

describe("COPY invariants", () => {
  it("every locale has every top-level key populated", () => {
    for (const l of LOCALES) {
      const c = COPY[l];
      expect(c.hero.headline.length).toBeGreaterThan(0);
      expect(c.hero.sub.length).toBeGreaterThan(0);
      expect(c.hero.ctaPrimary.length).toBeGreaterThan(0);
      expect(c.features.length).toBeGreaterThanOrEqual(3);
      expect(c.security.bullets.length).toBeGreaterThanOrEqual(3);
      expect(c.download.platforms.length).toBeGreaterThanOrEqual(1);
      expect(c.about.body.length).toBeGreaterThan(0);
    }
  });

  it("feature count is identical across locales", () => {
    const counts = LOCALES.map((l) => COPY[l].features.length);
    expect(new Set(counts).size).toBe(1);
  });

  it("security bullet count is identical across locales", () => {
    const counts = LOCALES.map((l) => COPY[l].security.bullets.length);
    expect(new Set(counts).size).toBe(1);
  });

  it("download platform names are identical sets across locales", () => {
    // Identity is by `ext` (platform type) — copy can differ per locale
    // but the canonical list of platforms must match.
    const exts = LOCALES.map((l) => COPY[l].download.platforms.map((p) => p.ext).sort());
    expect(exts[0]).toEqual(exts[1]);
  });

  it("every feature has a non-empty icon + title + body", () => {
    for (const l of LOCALES) {
      for (const f of COPY[l].features) {
        expect(f.icon).toMatch(/\S/);
        expect(f.title).toMatch(/\S/);
        expect(f.body).toMatch(/\S/);
      }
    }
  });
});
