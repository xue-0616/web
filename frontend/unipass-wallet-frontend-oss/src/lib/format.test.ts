import { describe, expect, it } from "vitest";

import { chainLabel, formatAmount, isValidAddress, parseAmount, shortAddr } from "./format";

const ADDR = "0x" + "a".repeat(40);

describe("shortAddr", () => {
  it("ellipsises valid addr", () => {
    expect(shortAddr(ADDR)).toBe("0xaaaa…aaaa");
  });
  it("passes through malformed", () => {
    expect(shortAddr("0xdead")).toBe("0xdead");
  });
});

describe("chainLabel", () => {
  it.each([
    [1, "Ethereum"],
    [56, "BNB"],
    [137, "Polygon"],
    [999, "Chain 999"],
  ])("chainLabel(%d) === %s", (id, want) => {
    expect(chainLabel(id as number)).toBe(want);
  });
});

describe("formatAmount", () => {
  it("whole units", () => {
    expect(formatAmount("1000000", 6)).toBe("1");
  });
  it("fractional trims trailing zeros", () => {
    expect(formatAmount("1500000", 6)).toBe("1.5");
    expect(formatAmount("1230000", 6)).toBe("1.23");
  });
  it("sub-unit amounts pad fraction", () => {
    expect(formatAmount("1", 6)).toBe("0.000001");
  });
  it("decimals=0 echoes input", () => {
    expect(formatAmount("123", 0)).toBe("123");
  });
  it("handles big-int precision (no scientific notation)", () => {
    const huge = "1" + "0".repeat(30);
    expect(formatAmount(huge, 18)).not.toMatch(/e/i);
  });
  it("malformed input passes through", () => {
    expect(formatAmount("abc", 6)).toBe("abc");
  });
});

describe("isValidAddress", () => {
  it("accepts proper form", () => {
    expect(isValidAddress(ADDR)).toBe(true);
  });
  it.each(["0x", "0xdead", "deadbeef", "", "0x" + "g".repeat(40)])("rejects %j", (s) => {
    expect(isValidAddress(s)).toBe(false);
  });
});

describe("parseAmount", () => {
  it("parses whole units", () => {
    expect(parseAmount("1", 6)).toBe("1000000");
  });
  it("parses fractional", () => {
    expect(parseAmount("1.5", 6)).toBe("1500000");
    expect(parseAmount("0.000001", 6)).toBe("1");
  });
  it("rejects too many decimals", () => {
    expect(parseAmount("1.1234567", 6)).toBeNull();
  });
  it("rejects garbage", () => {
    expect(parseAmount("abc", 6)).toBeNull();
    expect(parseAmount("1.2.3", 6)).toBeNull();
    expect(parseAmount("", 6)).toBeNull();
  });
  it("round-trips with formatAmount", () => {
    const cases = ["1", "1.5", "0.000001", "100"];
    for (const c of cases) {
      const parsed = parseAmount(c, 6);
      expect(parsed).not.toBeNull();
      if (parsed) expect(formatAmount(parsed, 6)).toBe(c === "100" ? "100" : c);
    }
  });
});
