"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createHttpClient, type VerifyClient, type VerifyOutcome } from "@/lib/api";
import { DICT, type Locale, pickLocale } from "@/lib/i18n";
import { formatCountdown, isCompleteOtp } from "@/lib/otp";

import { OtpInput, type OtpInputHandle } from "./OtpInput";

const RESEND_COOLDOWN_SECS = 30;

export interface VerifyPanelProps {
  to?: string;
  /** Injected for tests. Defaults to a real fetch-backed client. */
  client?: VerifyClient;
  /** Injected for tests. Defaults to `navigator.languages`. */
  localeCandidates?: readonly string[];
  /** Injected for tests. Defaults to `window.location.assign`. */
  onRedirect?: (url: string) => void;
}

type UiState =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "success"; redirectTo: string }
  | { kind: "error"; messageKey: "errorBadCode" | "errorExpired" | "errorRateLimited" | "errorGeneric" };

/**
 * The verify panel. All business-logic surfaces are injectable via
 * props so tests can drive the whole state machine without touching
 * the DOM network or global navigator.
 */
export function VerifyPanel({
  to,
  client: clientOverride,
  localeCandidates,
  onRedirect,
}: VerifyPanelProps) {
  const client = useMemo(() => clientOverride ?? createHttpClient(), [clientOverride]);
  const locale: Locale = useMemo(
    () =>
      pickLocale(
        localeCandidates ??
          (typeof navigator !== "undefined" ? navigator.languages : undefined),
      ),
    [localeCandidates],
  );
  const t = DICT[locale];

  const [code, setCode] = useState("");
  const [state, setState] = useState<UiState>({ kind: "idle" });
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECS);
  const otpRef = useRef<OtpInputHandle>(null);

  // Cooldown ticker. Uses a single setTimeout chain so we never stack
  // intervals across re-renders.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const runVerify = useCallback(
    async (c: string) => {
      if (!isCompleteOtp(c)) return;
      setState({ kind: "verifying" });
      const outcome: VerifyOutcome = await client.verify(c);
      switch (outcome.kind) {
        case "success":
          setState({ kind: "success", redirectTo: outcome.redirectTo });
          (onRedirect ??
            ((u: string) => {
              if (typeof window !== "undefined") window.location.assign(u);
            }))(outcome.redirectTo);
          return;
        case "bad-code":
          setState({ kind: "error", messageKey: "errorBadCode" });
          otpRef.current?.clear();
          return;
        case "expired":
          setState({ kind: "error", messageKey: "errorExpired" });
          return;
        case "rate-limited":
          setState({ kind: "error", messageKey: "errorRateLimited" });
          if (outcome.retryAfterSecs) setCooldown(outcome.retryAfterSecs);
          return;
        default:
          setState({ kind: "error", messageKey: "errorGeneric" });
      }
    },
    [client, onRedirect],
  );

  const onResend = useCallback(async () => {
    if (cooldown > 0) return;
    const r = await client.resend();
    setCooldown(r.retryAfterSecs ?? RESEND_COOLDOWN_SECS);
    // Optimistically clear any prior error state so the user sees a
    // clean slate when the new email arrives.
    setState({ kind: "idle" });
    otpRef.current?.clear();
  }, [client, cooldown]);

  if (state.kind === "success") {
    return (
      <article style={cardStyle}>
        <h1 style={{ margin: 0 }}>{t.successHeadline}</h1>
        <p style={{ color: "var(--muted)" }}>{t.successBody}</p>
      </article>
    );
  }

  const verifying = state.kind === "verifying";
  const errorKey = state.kind === "error" ? state.messageKey : null;
  const errorId = errorKey ? "verify-error" : undefined;

  return (
    <article style={cardStyle} aria-busy={verifying}>
      <h1 style={{ margin: 0 }}>{t.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        {t.subtitle}
        {to ? <> <strong>{to}</strong></> : null}
      </p>

      <div style={{ marginTop: "2rem" }}>
        <OtpInput
          ref={otpRef}
          value={code}
          onChange={setCode}
          onComplete={runVerify}
          disabled={verifying}
          ariaLabel={t.title}
          errorId={errorId}
        />
      </div>

      {errorKey ? (
        <p
          id={errorId}
          role="alert"
          style={{ color: "var(--danger)", marginTop: "1rem", minHeight: "1.25rem" }}
        >
          {t[errorKey]}
        </p>
      ) : (
        <p style={{ minHeight: "1.25rem", marginTop: "1rem" }} aria-live="polite">
          {verifying ? t.verifying : "\u00a0"}
        </p>
      )}

      <button
        type="button"
        onClick={() => runVerify(code)}
        disabled={!isCompleteOtp(code) || verifying}
        style={{
          marginTop: "0.5rem",
          width: "100%",
          padding: "0.75rem 1rem",
          background: "var(--primary)",
          color: "white",
          borderRadius: "0.5rem",
          fontSize: "1rem",
        }}
      >
        {t.submit}
      </button>

      <button
        type="button"
        onClick={onResend}
        disabled={cooldown > 0}
        style={{
          marginTop: "0.75rem",
          width: "100%",
          padding: "0.5rem 1rem",
          background: "transparent",
          color: "var(--primary)",
          fontSize: "0.875rem",
        }}
      >
        {cooldown > 0 ? t.resendIn(formatCountdown(cooldown)) : t.resend}
      </button>
    </article>
  );
}

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "24rem",
  padding: "2rem",
  background: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: "1rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};
