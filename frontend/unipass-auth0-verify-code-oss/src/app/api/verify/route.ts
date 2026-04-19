import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { loadAuth0Config, verifyOtpWithAuth0 } from "@/lib/auth0";

/**
 * Server-side proxy to Auth0's Passwordless OTP grant.
 *
 * The client POSTs `{ code: "123456" }`. This handler:
 *   1. pulls the pending email out of the short-lived `up_verify_to`
 *      cookie (set by the page that redirects here from Auth0's
 *      "we just mailed you a code" screen),
 *   2. calls `/oauth/token` with the OTP,
 *   3. stores the access token as an HttpOnly `up_session` cookie,
 *   4. returns `{ redirect_to }`.
 *
 * Response contract (consumed by `@/lib/api::mapVerifyResponse`):
 *   * 200 `{ redirect_to }`                           — success
 *   * 400 `{ error: "bad_code" | "invalid_otp" }`     — wrong code
 *   * 410                                             — expired
 *   * 429 + optional `Retry-After` header             — rate-limited
 *   * 500 `{ error: "misconfigured", missing: [...] }` — ops error
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const code =
    typeof body === "object" && body !== null && typeof (body as { code?: unknown }).code === "string"
      ? (body as { code: string }).code
      : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  // Dev-only shortcut: if Auth0 env is unset, treat 123456 as the only
  // valid code so local smoke tests still exercise both branches without
  // a real Auth0 tenant. **Production MUST set the env vars** — the
  // `loadAuth0Config` call below will surface a 500 if they're missing
  // in a deployed build (where the runtime is definitely not in dev).
  const cfg = loadAuth0Config({
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  });
  if (!cfg.ok) {
    if (process.env.NODE_ENV !== "production") {
      return code === "123456"
        ? NextResponse.json({ redirect_to: "/welcome" })
        : NextResponse.json({ error: "bad_code" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "misconfigured", missing: cfg.missing },
      { status: 500 },
    );
  }

  const username = cookies().get("up_verify_to")?.value;
  if (!username) {
    return NextResponse.json({ error: "session_expired" }, { status: 410 });
  }

  const outcome = await verifyOtpWithAuth0(cfg.value, username, code);
  switch (outcome.kind) {
    case "ok": {
      const res = NextResponse.json({ redirect_to: "/welcome" });
      res.cookies.set("up_session", outcome.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: outcome.expiresIn ?? 3600,
      });
      // One-shot — burn the pending-email cookie now.
      res.cookies.delete("up_verify_to");
      return res;
    }
    case "bad-code":
      return NextResponse.json({ error: "bad_code" }, { status: 400 });
    case "expired":
      return NextResponse.json({}, { status: 410 });
    case "rate-limited":
      return NextResponse.json(
        {},
        {
          status: 429,
          headers: outcome.retryAfterSecs
            ? { "retry-after": String(outcome.retryAfterSecs) }
            : undefined,
        },
      );
    default:
      return NextResponse.json({ error: outcome.message }, { status: 500 });
  }
}
