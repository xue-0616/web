import { describe, expect, it, vi } from "vitest";

import { loadAuth0Config, verifyOtpWithAuth0 } from "./auth0";

describe("loadAuth0Config", () => {
  it("returns ok when all vars present", () => {
    const r = loadAuth0Config({
      AUTH0_DOMAIN: "d", AUTH0_CLIENT_ID: "c", AUTH0_CLIENT_SECRET: "s",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.domain).toBe("d");
      expect(r.value.clientId).toBe("c");
    }
  });

  it("reports every missing var", () => {
    const r = loadAuth0Config({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing.sort()).toEqual([
        "AUTH0_CLIENT_ID",
        "AUTH0_CLIENT_SECRET",
        "AUTH0_DOMAIN",
      ]);
    }
  });

  it("partial config surfaces only the gaps", () => {
    const r = loadAuth0Config({ AUTH0_DOMAIN: "d" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing).toContain("AUTH0_CLIENT_ID");
      expect(r.missing).not.toContain("AUTH0_DOMAIN");
    }
  });
});

const CFG = { domain: "tenant.auth0.com", clientId: "cid", clientSecret: "csec" };

function mkFetch(...resps: Response[]) {
  const mock = vi.fn();
  for (const r of resps) mock.mockResolvedValueOnce(r);
  return mock as unknown as typeof fetch;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("verifyOtpWithAuth0", () => {
  it("returns ok on 200 with access_token", async () => {
    const f = mkFetch(json(200, { access_token: "T", id_token: "I", expires_in: 3600 }));
    const r = await verifyOtpWithAuth0(CFG, "u@e", "123456", "email", f);
    expect(r).toEqual({ kind: "ok", accessToken: "T", idToken: "I", expiresIn: 3600 });
  });

  it("sends the expected passwordless-OTP grant body", async () => {
    const captured = vi.fn();
    const f: typeof fetch = async (url, init) => {
      captured(url, init);
      return json(200, { access_token: "T" });
    };
    await verifyOtpWithAuth0(CFG, "u@e", "123456", "email", f);
    const [url, init] = captured.mock.calls[0];
    expect(url).toBe("https://tenant.auth0.com/oauth/token");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.grant_type).toBe("http://auth0.com/oauth/grant-type/passwordless/otp");
    expect(body.client_id).toBe("cid");
    expect(body.client_secret).toBe("csec");
    expect(body.username).toBe("u@e");
    expect(body.otp).toBe("123456");
    expect(body.realm).toBe("email");
  });

  it("maps 403 invalid_grant → bad-code", async () => {
    const f = mkFetch(
      json(403, { error: "invalid_grant", error_description: "Wrong email or verification code." }),
    );
    expect(await verifyOtpWithAuth0(CFG, "u", "000000", "email", f)).toEqual({ kind: "bad-code" });
  });

  it("maps expired-code phrasing → expired", async () => {
    const f = mkFetch(
      json(403, { error: "invalid_grant", error_description: "The verification code has expired." }),
    );
    expect(await verifyOtpWithAuth0(CFG, "u", "0", "email", f)).toEqual({ kind: "expired" });
  });

  it("maps 429 → rate-limited with Retry-After", async () => {
    const f = mkFetch(json(429, {}, { "retry-after": "30" }));
    expect(await verifyOtpWithAuth0(CFG, "u", "0", "email", f)).toEqual({
      kind: "rate-limited", retryAfterSecs: 30,
    });
  });

  it("maps 429 without Retry-After", async () => {
    const f = mkFetch(json(429, {}));
    expect(await verifyOtpWithAuth0(CFG, "u", "0", "email", f)).toEqual({ kind: "rate-limited" });
  });

  it("maps unknown 500 → error", async () => {
    const f = mkFetch(json(500, { error: "server_exploded", error_description: "boom" }));
    const r = await verifyOtpWithAuth0(CFG, "u", "0", "email", f);
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message).toBe("boom");
  });

  it("handles network errors gracefully", async () => {
    const f = (async () => {
      throw new Error("ETIMEDOUT");
    }) as unknown as typeof fetch;
    const r = await verifyOtpWithAuth0(CFG, "u", "0", "email", f);
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message).toBe("ETIMEDOUT");
  });

  it("rejects 200 response without access_token", async () => {
    const f = mkFetch(json(200, { id_token: "only-id" }));
    const r = await verifyOtpWithAuth0(CFG, "u", "0", "email", f);
    expect(r.kind).toBe("error");
  });
});
