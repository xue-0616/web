/**
 * Pure validators for Solana Blink URLs.
 *
 * BUG-S1 (HIGH): `BlinkService.getUrlByShortCode` historically returned
 * whatever URL the DB had on file without re-checking that the host is
 * still in the trusted actions registry. A caller who could plant a row
 * (e.g. via a loosely-validated `findOrInsert`) could redirect users to
 * a phishing Solana Action endpoint that drains wallets on click.
 *
 * This module is pure (no NestJS / Redis / DB deps) so it's trivial to
 * unit-test — see `blink-url.validator.test.ts`.
 */

/** Parse a URL. Returns null for anything that isn't a well-formed URL. */
function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Normalise a host string for comparison:
 *   - lowercase
 *   - strip a leading `www.` so `www.foo.com` matches a trusted `foo.com`
 *
 * We do NOT strip sub-domains beyond that — `evil.foo.com` must appear
 * in the list explicitly if it's meant to be trusted.
 */
export function normaliseHost(host: string): string {
  const h = host.toLowerCase().trim();
  return h.startsWith('www.') ? h.slice(4) : h;
}

export interface UrlCheckResult {
  ok: boolean;
  reason?: string;
  /** The matched trusted host, if ok. */
  host?: string;
}

/**
 * Validate a blink URL against a list of trusted hosts.
 *
 * Rules:
 *   - URL must parse and use `https:` (http allowed only for `localhost`
 *     in tests — production callers should never include it in the list).
 *   - Hostname (normalised) must exactly match an entry in `trustedHosts`
 *     (which we also normalise). No substring / prefix matching — that
 *     historically led to bypasses like `trusted.com.evil.attacker`.
 *   - URL must not embed credentials (`https://user:pass@host/...`) —
 *     common phishing trick.
 */
/**
 * Query-param keys commonly used by blink proxies (e.g. `proxy.dial.to`)
 * to smuggle an arbitrary target URL through an allow-listed outer
 * host. BUG-S6 defence.
 */
const PROXY_URL_PARAMS = ['url', 'redirect', 'action', 'target', 'href'] as const;

export function isTrustedBlinkUrl(
  url: unknown,
  trustedHosts: readonly string[],
): UrlCheckResult {
  if (typeof url !== 'string' || url.length === 0) {
    return { ok: false, reason: 'url must be a non-empty string' };
  }
  const parsed = safeParseUrl(url);
  if (!parsed) {
    return { ok: false, reason: 'url is not a valid URL' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'url must not embed credentials' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `url must use https, got ${parsed.protocol}` };
  }
  const allowed = new Set(trustedHosts.map(normaliseHost));
  const target = normaliseHost(parsed.hostname);
  if (!allowed.has(target)) {
    return { ok: false, reason: `host ${target} is not in trusted list` };
  }
  // BUG-S6 fix: if the URL carries an embedded-URL query param
  // (proxy-style), recursively verify that inner URL is also trusted.
  // Otherwise an allow-listed proxy host (e.g. `proxy.dial.to`) would
  // let an attacker serve arbitrary content via `?url=https://evil`.
  for (const key of PROXY_URL_PARAMS) {
    const inner = parsed.searchParams.get(key);
    if (!inner) continue;
    const innerCheck = isTrustedBlinkUrl(inner, trustedHosts);
    if (!innerCheck.ok) {
      return {
        ok: false,
        reason: `proxy query param "${key}" points to untrusted URL: ${innerCheck.reason}`,
      };
    }
  }
  return { ok: true, host: target };
}
