import { describe, expect, it } from "vitest";

import { mapVerifyResponse, parseRetryAfter } from "./api";

function mkResp(status: number, body?: unknown, headers?: Record<string, string>) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("parseRetryAfter", () => {
  it.each([
    [null, undefined],
    ["", undefined],
    ["abc", undefined],
    ["0", 0],
    ["30", 30],
    ["-5", undefined],
  ])("parseRetryAfter(%j) === %j", (h, want) => {
    expect(parseRetryAfter(h)).toBe(want);
  });
});

describe("mapVerifyResponse", () => {
  it("maps 200 with redirect_to → success", async () => {
    const r = await mapVerifyResponse(mkResp(200, { redirect_to: "/dashboard" }));
    expect(r).toEqual({ kind: "success", redirectTo: "/dashboard" });
  });

  it("maps 200 without redirect_to → success with default", async () => {
    const r = await mapVerifyResponse(mkResp(200, {}));
    expect(r).toEqual({ kind: "success", redirectTo: "/" });
  });

  it("maps 200 with non-json body → success with default", async () => {
    const r = await mapVerifyResponse(new Response("not json", { status: 200 }));
    expect(r).toEqual({ kind: "success", redirectTo: "/" });
  });

  it("maps 400 bad_code → bad-code", async () => {
    const r = await mapVerifyResponse(mkResp(400, { error: "bad_code" }));
    expect(r).toEqual({ kind: "bad-code" });
  });

  it("maps 400 invalid_otp → bad-code (alias)", async () => {
    const r = await mapVerifyResponse(mkResp(400, { error: "invalid_otp" }));
    expect(r).toEqual({ kind: "bad-code" });
  });

  it("maps 410 → expired", async () => {
    const r = await mapVerifyResponse(mkResp(410, {}));
    expect(r).toEqual({ kind: "expired" });
  });

  it("maps 400 expired alias → expired", async () => {
    const r = await mapVerifyResponse(mkResp(400, { error: "expired" }));
    expect(r).toEqual({ kind: "expired" });
  });

  it("maps 429 without header → rate-limited without retry", async () => {
    const r = await mapVerifyResponse(mkResp(429, {}));
    expect(r).toEqual({ kind: "rate-limited" });
  });

  it("maps 429 with retry-after → rate-limited with retry", async () => {
    const r = await mapVerifyResponse(mkResp(429, {}, { "retry-after": "60" }));
    expect(r).toEqual({ kind: "rate-limited", retryAfterSecs: 60 });
  });

  it("maps unknown 500 → error", async () => {
    const r = await mapVerifyResponse(mkResp(500, { error: "server_exploded" }));
    expect(r).toEqual({ kind: "error", message: "HTTP 500" });
  });

  it("maps 400 with unknown error-code → error (not bad-code)", async () => {
    // Ensures the mapping is strict and doesn't accidentally surface
    // server-internal error codes as user-facing bad-code.
    const r = await mapVerifyResponse(mkResp(400, { error: "some_other_thing" }));
    expect(r).toEqual({ kind: "error", message: "HTTP 400" });
  });
});
