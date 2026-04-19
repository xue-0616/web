import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { shouldAutoLock, useSessionStore } from "./session";

describe("useSessionStore", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("starts locked", () => {
    const s = useSessionStore();
    expect(s.isUnlocked).toBe(false);
    expect(s.address).toBeNull();
  });

  it("unlock lowercases address and sets chain + email", () => {
    const s = useSessionStore();
    s.unlock({ address: "0xAbC" + "0".repeat(37), chainId: 137, email: "x@y" });
    expect(s.address).toBe(("0xAbC" + "0".repeat(37)).toLowerCase());
    expect(s.chainId).toBe(137);
    expect(s.email).toBe("x@y");
    expect(s.isUnlocked).toBe(true);
    expect(s.lastActivityMs).toBeGreaterThan(0);
  });

  it("lock clears address but preserves email", () => {
    const s = useSessionStore();
    s.unlock({ address: "0x" + "a".repeat(40), chainId: 1, email: "e" });
    s.lock();
    expect(s.isUnlocked).toBe(false);
    expect(s.email).toBe("e");
  });

  it("touch advances lastActivityMs", async () => {
    const s = useSessionStore();
    s.unlock({ address: "0x" + "a".repeat(40), chainId: 1 });
    const before = s.lastActivityMs;
    await new Promise((r) => setTimeout(r, 2));
    s.touch();
    expect(s.lastActivityMs).toBeGreaterThanOrEqual(before);
  });

  it("setChain mutates chainId", () => {
    const s = useSessionStore();
    s.setChain(56);
    expect(s.chainId).toBe(56);
  });
});

describe("shouldAutoLock", () => {
  it("returns false when never active (lastActivityMs=0)", () => {
    expect(shouldAutoLock(0, 1_000_000, 1000)).toBe(false);
  });
  it("returns false while still within the idle window", () => {
    expect(shouldAutoLock(1000, 1500, 1000)).toBe(false);
  });
  it("returns true at exactly the threshold", () => {
    expect(shouldAutoLock(1000, 2000, 1000)).toBe(true);
  });
  it("returns true past the threshold", () => {
    expect(shouldAutoLock(1000, 10_000, 1000)).toBe(true);
  });
});
