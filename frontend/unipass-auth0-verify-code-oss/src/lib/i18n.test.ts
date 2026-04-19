import { describe, expect, it } from "vitest";

import { DICT, pickLocale, supportedLocales } from "./i18n";

describe("pickLocale", () => {
  it("defaults to en for unknown / empty / missing", () => {
    expect(pickLocale([])).toBe("en");
    expect(pickLocale(undefined)).toBe("en");
    expect(pickLocale(["de", "fr"])).toBe("en");
  });
  it("returns en for en variants", () => {
    expect(pickLocale(["en"])).toBe("en");
    expect(pickLocale(["en-US"])).toBe("en");
    expect(pickLocale(["en-GB"])).toBe("en");
  });
  it("returns zh-CN for standard zh variants", () => {
    expect(pickLocale(["zh-CN"])).toBe("zh-CN");
    expect(pickLocale(["zh-Hans-CN"])).toBe("zh-CN");
    expect(pickLocale(["zh-hans"])).toBe("zh-CN");
    expect(pickLocale(["zh"])).toBe("zh-CN");
    expect(pickLocale(["zh-TW"])).toBe("zh-CN"); // best-effort fallback
  });
  it("respects preference ordering", () => {
    expect(pickLocale(["de", "zh-CN", "en-US"])).toBe("zh-CN");
    expect(pickLocale(["de", "en-US", "zh-CN"])).toBe("en");
  });
  it("is case-insensitive", () => {
    expect(pickLocale(["EN-US"])).toBe("en");
    expect(pickLocale(["ZH-cn"])).toBe("zh-CN");
  });
});

describe("DICT invariants", () => {
  it("all locales expose the same keys", () => {
    const keys = supportedLocales().map((l) => Object.keys(DICT[l]).sort());
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).toEqual(keys[0]);
    }
  });
  it("resendIn is a function producing a string containing the arg", () => {
    expect(DICT.en.resendIn("0:42")).toContain("0:42");
    expect(DICT["zh-CN"].resendIn("0:42")).toContain("0:42");
  });
  it("title is non-empty for all locales", () => {
    for (const l of supportedLocales()) {
      expect(DICT[l].title.length).toBeGreaterThan(0);
    }
  });
});
