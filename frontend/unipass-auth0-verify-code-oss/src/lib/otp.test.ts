import { describe, expect, it } from "vitest";

import {
  formatCountdown,
  isCompleteOtp,
  onDigitChange,
  OTP_LENGTH,
  pasteSplay,
  sanitizeOtp,
} from "./otp";

describe("sanitizeOtp", () => {
  it("strips non-digit characters", () => {
    expect(sanitizeOtp("12ab34 56")).toBe("123456");
  });
  it("truncates to OTP_LENGTH", () => {
    expect(sanitizeOtp("1234567890")).toBe("123456");
  });
  it("returns empty string for all-junk input", () => {
    expect(sanitizeOtp("abcdef")).toBe("");
  });
  it("handles unicode whitespace", () => {
    expect(sanitizeOtp("1\u00a02\u20033")).toBe("123");
  });
});

describe("isCompleteOtp", () => {
  it("accepts exactly 6 digits", () => {
    expect(isCompleteOtp("123456")).toBe(true);
  });
  it.each(["12345", "1234567", "", "abcdef", "12 456"])("rejects %j", (s) => {
    expect(isCompleteOtp(s)).toBe(false);
  });
});

describe("pasteSplay", () => {
  it("fills from startIndex forward without overflow", () => {
    const empty = ["", "", "", "", "", ""];
    expect(pasteSplay(empty, 2, "9876")).toEqual(["", "", "9", "8", "7", "6"]);
  });
  it("truncates when paste overflows", () => {
    const empty = ["", "", "", "", "", ""];
    expect(pasteSplay(empty, 4, "9876")).toEqual(["", "", "", "", "9", "8"]);
  });
  it("preserves prefix digits before startIndex", () => {
    const pre = ["1", "2", "", "", "", ""];
    expect(pasteSplay(pre, 2, "34")).toEqual(["1", "2", "3", "4", "", ""]);
  });
  it("ignores non-digits in paste", () => {
    const empty = ["", "", "", "", "", ""];
    expect(pasteSplay(empty, 0, "abc123x4")).toEqual(["1", "2", "3", "4", "", ""]);
  });
  it("does not mutate the input array", () => {
    const empty = ["", "", "", "", "", ""];
    pasteSplay(empty, 0, "123");
    expect(empty).toEqual(["", "", "", "", "", ""]);
  });
});

describe("onDigitChange", () => {
  it("moves focus forward on single digit entry", () => {
    const { digits, focus } = onDigitChange(["", "", "", "", "", ""], 0, "5");
    expect(digits).toEqual(["5", "", "", "", "", ""]);
    expect(focus).toBe(1);
  });
  it("keeps focus on last index after filling it", () => {
    const { focus } = onDigitChange(["1", "2", "3", "4", "5", ""], 5, "6");
    expect(focus).toBe(OTP_LENGTH - 1);
  });
  it("on erasure keeps focus on same index", () => {
    const { digits, focus } = onDigitChange(["1", "2", "3", "", "", ""], 2, "");
    expect(digits).toEqual(["1", "2", "", "", "", ""]);
    expect(focus).toBe(2);
  });
  it("splays a multi-char input starting from the current index", () => {
    const { digits, focus } = onDigitChange(["", "", "", "", "", ""], 1, "789");
    expect(digits).toEqual(["", "7", "8", "9", "", ""]);
    expect(focus).toBe(4);
  });
  it("strips non-digits from input", () => {
    const { digits } = onDigitChange(["", "", "", "", "", ""], 0, "a5b");
    expect(digits).toEqual(["5", "", "", "", "", ""]);
  });
});

describe("formatCountdown", () => {
  it.each([
    [0, "0:00"],
    [9, "0:09"],
    [60, "1:00"],
    [125, "2:05"],
    [-5, "0:00"],
    [3599, "59:59"],
  ])("formatCountdown(%d) === %j", (n, want) => {
    expect(formatCountdown(n)).toBe(want);
  });
});
