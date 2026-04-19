import { describe, expect, it } from "vitest";

import { chainLabel, formatAmount, parsePayment, shortAddress } from "./payment";

const ADDR_A = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const ADDR_B = "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb";

describe("parsePayment", () => {
  it("parses a happy-path deep-link", () => {
    const r = parsePayment(`pay://v1/?to=${ADDR_A}&chain=1&token=${ADDR_B}&amount=1500000&memo=Invoice%207`);
    expect(r).toEqual({
      ok: true,
      value: {
        to: ADDR_A.toLowerCase(),
        chain: 1,
        token: ADDR_B.toLowerCase(),
        amount: "1500000",
        memo: "Invoice 7",
      },
    });
  });

  it("accepts a bare query string (post ?pay= strip)", () => {
    const r = parsePayment(`to=${ADDR_A}&chain=137&amount=1`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.chain).toBe(137);
  });

  it("treats missing token as native", () => {
    const r = parsePayment(`to=${ADDR_A}&chain=1&amount=1`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.token).toBeNull();
  });

  it("rejects empty", () => {
    expect(parsePayment("")).toEqual({ ok: false, error: "empty" });
  });

  it("rejects missing / malformed to", () => {
    expect(parsePayment("chain=1&amount=1").ok).toBe(false);
    expect(parsePayment("to=0xdeadbeef&chain=1&amount=1").ok).toBe(false);
  });

  it("rejects non-numeric or zero chain", () => {
    expect(parsePayment(`to=${ADDR_A}&chain=abc&amount=1`).ok).toBe(false);
    expect(parsePayment(`to=${ADDR_A}&chain=0&amount=1`).ok).toBe(false);
  });

  it("rejects zero or non-integer amount", () => {
    expect(parsePayment(`to=${ADDR_A}&chain=1&amount=0`).ok).toBe(false);
    expect(parsePayment(`to=${ADDR_A}&chain=1&amount=1.5`).ok).toBe(false);
    expect(parsePayment(`to=${ADDR_A}&chain=1&amount=-1`).ok).toBe(false);
  });

  it("rejects malformed token", () => {
    expect(
      parsePayment(`to=${ADDR_A}&chain=1&amount=1&token=0xnothex`).ok,
    ).toBe(false);
  });

  it("normalizes addresses to lowercase", () => {
    const r = parsePayment(`to=${ADDR_A}&chain=1&amount=1`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.to).toBe(ADDR_A.toLowerCase());
      expect(r.value.to).not.toBe(ADDR_A);
    }
  });

  it("empty memo becomes null", () => {
    const r = parsePayment(`to=${ADDR_A}&chain=1&amount=1&memo=`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.memo).toBeNull();
  });
});

describe("chainLabel", () => {
  it.each([
    [1, "Ethereum"],
    [10, "Optimism"],
    [56, "BNB Chain"],
    [137, "Polygon"],
    [42161, "Arbitrum"],
    [8453, "Base"],
  ])("chainLabel(%d) === %s", (id, want) => {
    expect(chainLabel(id as number)).toBe(want);
  });
  it("unknown ids fall back to numeric label", () => {
    expect(chainLabel(9999)).toBe("Chain 9999");
  });
});

describe("formatAmount", () => {
  it("formats whole units", () => {
    expect(formatAmount("1000000", 6, "USDC")).toBe("1 USDC");
    expect(formatAmount("1000000000000000000", 18, "ETH")).toBe("1 ETH");
  });
  it("formats fractional units and trims trailing zeros", () => {
    expect(formatAmount("1500000", 6, "USDC")).toBe("1.5 USDC");
    expect(formatAmount("1230000", 6, "USDC")).toBe("1.23 USDC");
  });
  it("handles zero decimals", () => {
    expect(formatAmount("42", 0, "FOO")).toBe("42 FOO");
  });
  it("handles sub-unit amounts (leading zeros in fractional part)", () => {
    expect(formatAmount("1", 6, "USDC")).toBe("0.000001 USDC");
  });
  it("preserves big-integer precision past 2^53", () => {
    const huge = "9".repeat(30);
    const out = formatAmount(huge, 18, "X");
    // Should not contain scientific notation or `e+`.
    expect(out).not.toMatch(/e/i);
  });
  it("echoes raw on malformed input", () => {
    expect(formatAmount("abc", 6, "USDC")).toBe("abc USDC");
  });
});

describe("shortAddress", () => {
  it("truncates with ellipsis", () => {
    expect(shortAddress(ADDR_A)).toBe("0xAaAa...AaAa");
  });
  it("echoes malformed input unchanged", () => {
    expect(shortAddress("0xdead")).toBe("0xdead");
  });
});
