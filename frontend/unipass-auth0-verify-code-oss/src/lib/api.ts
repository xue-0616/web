/**
 * Verify-code API client.
 *
 * Wire protocol is agnostic to the underlying Auth0 tenant — the
 * browser POSTs JSON to a thin server-side proxy (`/api/verify` and
 * `/api/resend`) which holds the Auth0 client secret. Client-side we
 * only care about the public shape.
 */

export type VerifyOutcome =
  | { kind: "success"; redirectTo: string }
  | { kind: "bad-code" }
  | { kind: "expired" }
  | { kind: "rate-limited"; retryAfterSecs?: number }
  | { kind: "error"; message: string };

export interface VerifyClient {
  verify(code: string): Promise<VerifyOutcome>;
  resend(): Promise<{ ok: boolean; retryAfterSecs?: number }>;
}

/**
 * Map a fetch `Response` to a `VerifyOutcome`. Exported so tests can
 * exercise every branch without spinning up MSW. The body is expected
 * to be JSON with either `{ redirect_to }` on success or
 * `{ error: "<code>" }` on failure.
 */
export async function mapVerifyResponse(resp: Response): Promise<VerifyOutcome> {
  if (resp.ok) {
    const body = await safeJson(resp);
    const redirectTo = typeof body?.redirect_to === "string" ? body.redirect_to : "/";
    return { kind: "success", redirectTo };
  }
  if (resp.status === 429) {
    const retry = parseRetryAfter(resp.headers.get("retry-after"));
    return { kind: "rate-limited", retryAfterSecs: retry };
  }
  const body = await safeJson(resp);
  const code = typeof body?.error === "string" ? body.error : "";
  if (resp.status === 400 && (code === "bad_code" || code === "invalid_otp")) {
    return { kind: "bad-code" };
  }
  if (resp.status === 410 || code === "expired") {
    return { kind: "expired" };
  }
  return { kind: "error", message: `HTTP ${resp.status}` };
}

/** Parse a numeric Retry-After header. Returns undefined if unparseable. */
export function parseRetryAfter(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

async function safeJson(resp: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Default fetch-backed client used by the page. */
export function createHttpClient(base = ""): VerifyClient {
  return {
    async verify(code: string): Promise<VerifyOutcome> {
      try {
        const resp = await fetch(`${base}/api/verify`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        return mapVerifyResponse(resp);
      } catch (e) {
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "network",
        };
      }
    },
    async resend() {
      try {
        const resp = await fetch(`${base}/api/resend`, { method: "POST" });
        const retry = parseRetryAfter(resp.headers.get("retry-after"));
        return { ok: resp.ok, retryAfterSecs: retry };
      } catch {
        return { ok: false };
      }
    },
  };
}
