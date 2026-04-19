import { describe, expect, it } from "vitest";

import { ActionError, buildPresetLinks, parseTipParams, validateAccount } from "./action";

const VALID = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp9PVbYDQ7F6wV";

describe("parseTipParams", () => {
  it("accepts a valid recipient + default amount", () => {
    const url = new URL(`https://blink.example/api/actions/tip?recipient=${VALID}`);
    const p = parseTipParams(url);
    expect(p.recipient).toBe(VALID);
    expect(p.amount).toBeCloseTo(0.01);
  });

  it("parses explicit amount", () => {
    const url = new URL(`https://blink.example/a?recipient=${VALID}&amount=0.5`);
    expect(parseTipParams(url).amount).toBeCloseTo(0.5);
  });

  it("rejects non-base58 recipient", () => {
    const url = new URL("https://x.example/a?recipient=foo-bar!");
    expect(() => parseTipParams(url)).toThrow(ActionError);
  });

  it("rejects empty recipient", () => {
    const url = new URL("https://x.example/a");
    expect(() => parseTipParams(url)).toThrow(/base58/);
  });

  it("rejects non-numeric amount", () => {
    const url = new URL(`https://x.example/a?recipient=${VALID}&amount=abc`);
    expect(() => parseTipParams(url)).toThrow(/positive number/);
  });

  it("rejects zero + negative", () => {
    expect(() => parseTipParams(new URL(`https://x.example/a?recipient=${VALID}&amount=0`))).toThrow();
    expect(() => parseTipParams(new URL(`https://x.example/a?recipient=${VALID}&amount=-5`))).toThrow();
  });

  it("caps amount at 1000 SOL", () => {
    const url = new URL(`https://x.example/a?recipient=${VALID}&amount=1001`);
    expect(() => parseTipParams(url)).toThrow(/1000/);
  });
});

describe("validateAccount", () => {
  it("accepts valid base58", () => {
    expect(() => validateAccount(VALID)).not.toThrow();
  });

  it("rejects non-base58", () => {
    expect(() => validateAccount("0xabc")).toThrow(ActionError);
    expect(() => validateAccount("")).toThrow(ActionError);
    expect(() => validateAccount("tooshort")).toThrow(ActionError);
  });
});

describe("buildPresetLinks", () => {
  it("produces 4 presets by default", () => {
    const links = buildPresetLinks(VALID, "/api/actions/tip");
    expect(links).toHaveLength(4);
    expect(links[0].label).toBe("0.01 SOL");
    expect(links[0].href).toContain(`recipient=${VALID}`);
    expect(links[0].href).toContain("amount=0.01");
  });

  it("respects a custom preset list", () => {
    const links = buildPresetLinks(VALID, "/a", [1, 10]);
    expect(links.map((l) => l.label)).toEqual(["1 SOL", "10 SOL"]);
  });
});
