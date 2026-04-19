import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSnapService,
  SnapServiceError,
  unwrapEnvelope,
} from "./snapService";

function makeResp(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("unwrapEnvelope", () => {
  it("returns data on code === 0", async () => {
    const r = makeResp(200, { code: 0, data: { x: 1 } });
    expect(await unwrapEnvelope<{ x: number }>(r)).toEqual({ x: 1 });
  });

  it("throws SnapServiceError on non-2xx even with valid envelope", async () => {
    const r = makeResp(401, { code: 401, message: "Unauthorized" });
    await expect(unwrapEnvelope(r)).rejects.toMatchObject({
      name: "SnapServiceError",
      status: 401,
      code: 401,
      message: "Unauthorized",
    });
  });

  it("throws on envelope with non-zero code even when HTTP is 200", async () => {
    const r = makeResp(200, { code: 1, message: "soft error" });
    await expect(unwrapEnvelope(r)).rejects.toBeInstanceOf(SnapServiceError);
  });

  it("throws on HTTP 200 with missing data field", async () => {
    const r = makeResp(200, { code: 0 });
    await expect(unwrapEnvelope(r)).rejects.toBeInstanceOf(SnapServiceError);
  });

  it("throws on malformed JSON body", async () => {
    const r = new Response("<html>not json</html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    });
    await expect(unwrapEnvelope(r)).rejects.toMatchObject({
      name: "SnapServiceError",
      status: 500,
    });
  });
});

describe("createSnapService", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mock = (resp: Response) => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(resp);
  };
  const captureFetch = () => (globalThis.fetch as unknown as ReturnType<typeof vi.fn>);

  it("loginChallenge maps snake_case → camelCase", async () => {
    mock(makeResp(200, { code: 0, data: { nonce: "abc", ttl_secs: 600 } }));
    const s = createSnapService("http://svc");
    const out = await s.loginChallenge("0xabc");
    expect(out).toEqual({ nonce: "abc", ttlSecs: 600 });
    const [url, init] = captureFetch().mock.calls[0];
    expect(url).toBe("http://svc/v1/account/login_challenge");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.wallet_address).toBe("0xabc");
  });

  it("login sends all snake_case fields and returns token", async () => {
    mock(makeResp(200, { code: 0, data: { token: "eyJ.jwt" } }));
    const s = createSnapService("http://svc");
    const tok = await s.login("0xabc", "snap", "snap-id", "0xdead", "nonce1");
    expect(tok).toBe("eyJ.jwt");
    const init = captureFetch().mock.calls[0][1];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      wallet_address: "0xabc",
      provider_type: "snap",
      provider_identifier: "snap-id",
      signature: "0xdead",
      nonce: "nonce1",
    });
  });

  it("me attaches Authorization header", async () => {
    mock(makeResp(200, { code: 0, data: {
      id: 1, walletAddress: "0x1", providerType: "snap",
      providerIdentifier: "x", guideStatus: "not_start",
    }}));
    const s = createSnapService("http://svc");
    const info = await s.me("tok123");
    expect(info.id).toBe(1);
    const init = captureFetch().mock.calls[0][1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("txHistory clamps limit into [1, 100]", async () => {
    mock(makeResp(200, { code: 0, data: [] }));
    const s = createSnapService("http://svc");
    await s.txHistory("t", 999);
    expect(captureFetch().mock.calls[0][0]).toMatch(/limit=100$/);

    mock(makeResp(200, { code: 0, data: [] }));
    await s.txHistory("t", 0);
    expect(captureFetch().mock.calls[1][0]).toMatch(/limit=1$/);
  });

  it("propagates SnapServiceError on 401", async () => {
    mock(makeResp(401, { code: 401, message: "Unauthorized" }));
    const s = createSnapService("http://svc");
    await expect(s.me("bad")).rejects.toBeInstanceOf(SnapServiceError);
  });
});
