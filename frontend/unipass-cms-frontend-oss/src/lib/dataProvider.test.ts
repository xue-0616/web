import { describe, expect, it } from "vitest";

import { TOKEN_KEY } from "./auth";
import { buildHttpClient } from "./dataProvider";

function memStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return { getItem: (k: string) => m.get(k) ?? null };
}

describe("buildHttpClient (auth header injection)", () => {
  it("adds Authorization header when token present", () => {
    const client = buildHttpClient(memStorage({ [TOKEN_KEY]: "T123" }));
    const out = client("/u");
    expect(out.headers.get("Authorization")).toBe("Bearer T123");
  });

  it("omits Authorization when no token", () => {
    const client = buildHttpClient(memStorage());
    const out = client("/u");
    expect(out.headers.get("Authorization")).toBeNull();
  });

  it("preserves caller-provided headers", () => {
    const client = buildHttpClient(memStorage({ [TOKEN_KEY]: "T" }));
    const h = new Headers({ "x-custom": "v" });
    const out = client("/u", { headers: h });
    expect(out.headers.get("x-custom")).toBe("v");
    expect(out.headers.get("Authorization")).toBe("Bearer T");
  });

  it("defaults Accept header when caller omits headers", () => {
    const client = buildHttpClient(memStorage());
    const out = client("/u");
    expect(out.headers.get("Accept")).toBe("application/json");
  });
});
