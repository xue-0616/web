/**
 * Server-side Auth0 Passwordless verification helper.
 *
 * Keep this file **server-only** (never imported by a `"use client"`
 * module) so `AUTH0_CLIENT_SECRET` never reaches the browser.
 *
 * Wraps Auth0's "passwordless OTP" grant
 * (https://auth0.com/docs/api/authentication#authenticate-user).
 */

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
}

export interface Auth0Env {
  AUTH0_DOMAIN?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_CLIENT_SECRET?: string;
}

export type Auth0VerifyOutcome =
  | { kind: "ok"; accessToken: string; idToken?: string; expiresIn?: number }
  | { kind: "bad-code" }
  | { kind: "expired" }
  | { kind: "rate-limited"; retryAfterSecs?: number }
  | { kind: "error"; message: string };

/**
 * Read + validate the Auth0 config from process.env. Returns a list of
 * missing variable names when incomplete so the route handler can
 * emit a 500 with a precise error instead of a generic failure.
 */
export function loadAuth0Config(env: Auth0Env): { ok: true; value: Auth0Config } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (!env.AUTH0_DOMAIN) missing.push("AUTH0_DOMAIN");
  if (!env.AUTH0_CLIENT_ID) missing.push("AUTH0_CLIENT_ID");
  if (!env.AUTH0_CLIENT_SECRET) missing.push("AUTH0_CLIENT_SECRET");
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    value: {
      domain: env.AUTH0_DOMAIN!,
      clientId: env.AUTH0_CLIENT_ID!,
      clientSecret: env.AUTH0_CLIENT_SECRET!,
    },
  };
}

/**
 * POST to Auth0's `/oauth/token` with the passwordless OTP grant type.
 * Mapped into a narrow `Auth0VerifyOutcome` so the route handler stays
 * thin.
 */
export async function verifyOtpWithAuth0(
  cfg: Auth0Config,
  username: string,
  otp: string,
  realm: "email" | "sms" = "email",
  fetchFn: typeof fetch = fetch,
): Promise<Auth0VerifyOutcome> {
  let resp: Response;
  try {
    resp = await fetchFn(`https://${cfg.domain}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "http://auth0.com/oauth/grant-type/passwordless/otp",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        username,
        otp,
        realm,
        scope: "openid profile email",
      }),
    });
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "network" };
  }

  if (resp.status === 429) {
    const ra = resp.headers.get("retry-after");
    const n = ra ? Number.parseInt(ra, 10) : NaN;
    return { kind: "rate-limited", retryAfterSecs: Number.isFinite(n) && n >= 0 ? n : undefined };
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await resp.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  if (resp.ok) {
    const access = typeof body?.access_token === "string" ? body.access_token : null;
    if (!access) return { kind: "error", message: "missing access_token" };
    return {
      kind: "ok",
      accessToken: access,
      idToken: typeof body?.id_token === "string" ? body.id_token : undefined,
      expiresIn: typeof body?.expires_in === "number" ? body.expires_in : undefined,
    };
  }

  // Auth0 "invalid_grant" with description "Wrong email or verification code."
  const errCode = typeof body?.error === "string" ? body.error : "";
  const errDesc = typeof body?.error_description === "string" ? body.error_description : "";
  const lower = `${errCode} ${errDesc}`.toLowerCase();
  if (
    errCode === "invalid_grant" ||
    lower.includes("wrong email") ||
    lower.includes("verification code")
  ) {
    if (lower.includes("expired")) return { kind: "expired" };
    return { kind: "bad-code" };
  }
  return { kind: "error", message: errDesc || errCode || `HTTP ${resp.status}` };
}
