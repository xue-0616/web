import { describe, it, expect } from "vitest";

import { evaluateHoneypot, summarize, type TokenSnapshot } from "./honeypot";

// A pristine snapshot that should pass every check. Tests mutate one field
// at a time so a new check doesn't silently pass on regression.
const clean: TokenSnapshot = {
  mint: "Fak3M1ntPubKey111111111111111111111111111",
  mintAuthorityActive: false,
  freezeAuthorityActive: false,
  lpBurnedPct: 99,
  holderCount: 1200,
  top1Pct: 0.03,
  tokenExtensions: [],
  ageSeconds: 3600 * 24 * 7, // one week
  poolIsStandard: true,
};

describe("evaluateHoneypot", () => {
  it("passes a pristine token", () => {
    const v = evaluateHoneypot(clean);
    expect(v.block).toBe(false);
    expect(v.signals).toEqual([]);
    expect(v.riskScore).toBe(0);
  });

  it("blocks when mint authority is still live", () => {
    const v = evaluateHoneypot({ ...clean, mintAuthorityActive: true });
    expect(v.block).toBe(true);
    expect(v.signals.map((s) => s.code)).toContain("mint-authority-open");
  });

  it("blocks when freeze authority is still live", () => {
    const v = evaluateHoneypot({ ...clean, freezeAuthorityActive: true });
    expect(v.block).toBe(true);
    expect(v.signals.map((s) => s.code)).toContain("freeze-authority-open");
  });

  it("warns on partial LP burn but does not block", () => {
    const v = evaluateHoneypot({ ...clean, lpBurnedPct: 60 });
    expect(v.block).toBe(false);
    const sig = v.signals.find((s) => s.code === "lp-partially-burned");
    expect(sig?.severity).toBe("warn");
  });

  it("blocks when LP is not meaningfully burned", () => {
    const v = evaluateHoneypot({ ...clean, lpBurnedPct: 0 });
    expect(v.block).toBe(true);
    expect(v.signals.map((s) => s.code)).toContain("lp-not-burned");
  });

  it("blocks on TOKEN-2022 transfer hook", () => {
    const v = evaluateHoneypot({ ...clean, tokenExtensions: ["transfer-hook"] });
    expect(v.block).toBe(true);
    expect(v.signals.map((s) => s.code)).toContain("token2022-dangerous");
  });

  it("warns on top holder >10% but blocks >25%", () => {
    const warn = evaluateHoneypot({ ...clean, top1Pct: 0.15 });
    expect(warn.block).toBe(false);
    const block = evaluateHoneypot({ ...clean, top1Pct: 0.35 });
    expect(block.block).toBe(true);
  });

  it("riskScore caps at 100 for stacked dangers", () => {
    const v = evaluateHoneypot({
      ...clean,
      mintAuthorityActive: true,
      freezeAuthorityActive: true,
      lpBurnedPct: 0,
      tokenExtensions: ["transfer-hook", "permanent-delegate"],
      top1Pct: 0.5,
    });
    expect(v.riskScore).toBe(100);
    expect(v.block).toBe(true);
  });

  it("summarize produces a one-liner", () => {
    const v = evaluateHoneypot({ ...clean, lpBurnedPct: 0, top1Pct: 0.3 });
    const s = summarize(v);
    expect(s).toMatch(/danger/);
    expect(s).toMatch(/risk \d+\/100/);
  });

  it("holderCount missing → no holder signal (indexer outage should not block)", () => {
    const v = evaluateHoneypot({ ...clean, holderCount: undefined });
    expect(v.signals.map((s) => s.code)).not.toContain("holders-thin");
  });
});
