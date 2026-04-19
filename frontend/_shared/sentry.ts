/**
 * Shared Sentry bootstrap used by every front-end in `/frontend`.
 *
 * Why a file in `_shared` instead of an npm package? Each front-end
 * project owns its own `package.json` and we don't want to publish an
 * internal package just to share 30 lines. The file is symlinked /
 * copied into each project's `src/lib` at build time (see the README
 * next to this file).
 *
 * Usage (at the top of `main.tsx` / `layout.tsx`):
 *
 *     import { initSentry } from "@/lib/sentry";
 *     initSentry({ project: "solagram-wallet" });
 *
 * The function is a no-op when `VITE_SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
 * is unset, so local dev and CI don't need a real DSN.
 */

export interface InitSentryOptions {
  /** Short project slug used as the Sentry `release` prefix and tag. */
  project: string;
  /** Override the environment reported to Sentry. Defaults to `import.meta.env.MODE` / `NODE_ENV`. */
  environment?: string;
  /** 0..1 sample rate for performance transactions. Default 0 (off). */
  tracesSampleRate?: number;
}

/** Resolve the DSN from the two conventions used in this repo. */
function resolveDsn(): string | null {
  // Vite — every Phase 7 project exposes `import.meta.env`.
  const vite = (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env) || {};
  const dsn =
    vite.VITE_SENTRY_DSN ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SENTRY_DSN) ||
    (typeof process !== "undefined" && process.env?.VITE_SENTRY_DSN) ||
    "";
  return dsn.length > 0 ? dsn : null;
}

/**
 * Best-effort dynamic init — we import `@sentry/browser` via `await
 * import(…)` so projects that don't set a DSN never pay the bundle
 * cost. If the package isn't installed the catch swallows the error
 * and the call becomes a silent no-op.
 */
export async function initSentry(opts: InitSentryOptions): Promise<void> {
  const dsn = resolveDsn();
  if (!dsn) {
    // No DSN configured — stay silent so local dev logs stay clean.
    return;
  }

  try {
    const Sentry = (await import(/* @vite-ignore */ "@sentry/browser")) as {
      init: (o: Record<string, unknown>) => void;
    };
    const env = (typeof import.meta !== "undefined" && (import.meta as { env?: { MODE?: string } }).env?.MODE) ||
      (typeof process !== "undefined" && process.env?.NODE_ENV) ||
      "production";
    Sentry.init({
      dsn,
      release: `${opts.project}@${getVersion()}`,
      environment: opts.environment ?? env,
      tracesSampleRate: opts.tracesSampleRate ?? 0,
      // Scrub obvious secrets from breadcrumbs. Add project-specific
      // patterns in each project's own `beforeSend` hook.
      beforeSend(event: unknown) {
        return scrubSecrets(event as SentryEvent);
      },
    });
  } catch (err) {
    // `@sentry/browser` not installed — that's fine, we treat Sentry
    // as optional. Log once so developers see it during init, not on
    // every captured exception.
    // eslint-disable-next-line no-console
    console.info("[sentry] not installed, skipping init", err);
  }
}

function getVersion(): string {
  const vite = (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env) || {};
  return vite.VITE_APP_VERSION || "0.0.0";
}

interface SentryEvent {
  request?: { cookies?: unknown; headers?: Record<string, unknown> };
  extra?: Record<string, unknown>;
  breadcrumbs?: Array<{ data?: Record<string, unknown> }>;
}

/**
 * Remove obviously-sensitive fields before Sentry sees them. This is a
 * defence-in-depth layer on top of Sentry's own scrubber; when in
 * doubt we keep things OUT of Sentry.
 */
function scrubSecrets(event: SentryEvent): SentryEvent {
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      for (const h of ["authorization", "cookie", "x-api-key", "x-auth-token"]) {
        delete event.request.headers[h];
      }
    }
  }
  if (event.extra) {
    for (const k of Object.keys(event.extra)) {
      if (/secret|password|mnemonic|private|seed|token/i.test(k)) {
        event.extra[k] = "[redacted]";
      }
    }
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (b.data) {
        for (const k of Object.keys(b.data)) {
          if (/secret|password|mnemonic|private|seed|token/i.test(k)) {
            b.data[k] = "[redacted]";
          }
        }
      }
    }
  }
  return event;
}
