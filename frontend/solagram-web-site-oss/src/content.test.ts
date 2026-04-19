import { describe, expect, it } from "vitest";

import { FAQ, FEATURES, FOOTER, HERO, NAV } from "./content";

/**
 * Content invariants. These aren't about prose quality (that's a PR
 * review); they catch structural regressions — dead hrefs, missing
 * icons, dropped feature items.
 */
describe("content", () => {
  it("hero has both primary and secondary CTAs", () => {
    expect(HERO.ctaPrimary.href).toMatch(/^https?:\/\/|^\//);
    expect(HERO.ctaSecondary.href).toMatch(/^https?:\/\/|^\//);
  });

  it("every feature lists a known icon name", () => {
    const allowed = new Set(["wallet", "chat", "lock", "zap", "globe", "coin"]);
    for (const f of FEATURES) {
      expect(allowed.has(f.icon)).toBe(true);
    }
  });

  it("features cover 3+3 — a full 2-row grid", () => {
    expect(FEATURES.length).toBeGreaterThanOrEqual(6);
    expect(FEATURES.length % 3).toBe(0);
  });

  it("FAQ covers the four canonical questions", () => {
    const qs = FAQ.map((x) => x.q.toLowerCase());
    expect(qs.some((q) => q.includes("custodial"))).toBe(true);
    expect(qs.some((q) => q.includes("token"))).toBe(true);
    expect(qs.some((q) => q.includes("lose"))).toBe(true);
    expect(qs.some((q) => q.includes("cost"))).toBe(true);
  });

  it("nav & footer contain no duplicate labels", () => {
    const labels = [...NAV.map((n) => n.label), ...FOOTER.links.map((l) => l.label)];
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("all FAQ answers are at least 40 chars (actually-useful threshold)", () => {
    for (const item of FAQ) {
      expect(item.a.length).toBeGreaterThanOrEqual(40);
    }
  });
});
