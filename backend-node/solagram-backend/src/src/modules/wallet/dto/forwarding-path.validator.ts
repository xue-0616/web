/**
 * Pure validator for the forwarding-path input.
 *
 * BUG-S3 (MEDIUM): `forwardingSolanaApi` used to build the target URL
 * by string-concatenating a user-controlled `path` onto the configured
 * Solana API base. Without validation this was a substring-bypass
 * risk:
 *
 *   - `//evil.com/steal` — protocol-relative hijack (rare but real in
 *     some URL parsers / WAF config)
 *   - `/../../admin`    — path traversal to sibling endpoints
 *   - `/foo?api_key=xx` — query-string injection when we also append
 *     caller-supplied query params downstream
 *   - `/foo#frag`       — fragment that the proxy sees but our cache
 *     key logic doesn't
 *
 * We restrict `path` to a conservative safe alphabet and explicitly
 * reject `..`, CRLF, and schemes.
 */

const PATH_RE = /^\/[A-Za-z0-9/_\-.]*$/;

export interface PathValidation {
  ok: boolean;
  reason?: string;
}

/** Max length for a forwarding path. The real Solana JSON-RPC endpoints
 *  are all below 64 chars; 256 gives plenty of headroom without letting
 *  a caller blow up logs / URL parsers. */
export const MAX_PATH_CHARS = 256;

export function validateForwardingPath(path: unknown): PathValidation {
  if (typeof path !== 'string') {
    return { ok: false, reason: 'path must be a string' };
  }
  if (path.length === 0 || path.length > MAX_PATH_CHARS) {
    return {
      ok: false,
      reason: `path length must be in (0, ${MAX_PATH_CHARS}]`,
    };
  }
  if (!PATH_RE.test(path)) {
    return {
      ok: false,
      reason:
        "path must match /^\\/[A-Za-z0-9/_\\-.]*$/ — no ? # & query, fragments, or special chars allowed",
    };
  }
  // Reject any occurrence of `..` — path traversal guard that the
  // regex above allows (`.` is in the safe set for filenames like
  // `/favicon.ico`, but sequential dots enable climbing).
  if (path.includes('..')) {
    return { ok: false, reason: 'path must not contain ".."' };
  }
  // Reject `//` prefix (protocol-relative) — already blocked by the
  // regex because `//` in position 0-1 matches `^\/` + `\/`, but the
  // rest would still pass. Be explicit.
  if (path.startsWith('//')) {
    return { ok: false, reason: 'path must not start with //' };
  }
  return { ok: true };
}
