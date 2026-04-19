import { NextResponse } from "next/server";

/**
 * POST /api/resend — triggers a fresh OTP email.
 *
 * The default cooldown lives client-side (30s). The server can still
 * emit a `Retry-After` header to override on rate-limit.
 */
export async function POST() {
  // TODO(phase6): rate-limit via KV/Redis keyed on remote IP + cookie,
  // and invoke the OTP provider's resend endpoint.
  return NextResponse.json({ ok: true });
}
