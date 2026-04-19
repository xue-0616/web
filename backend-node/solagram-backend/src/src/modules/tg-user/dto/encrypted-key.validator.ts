/**
 * Pure validators for the encrypted-key upload path.
 *
 * BUG-S5 (MEDIUM): `SaveEncryptedKeyInputDto` only declared `@IsString()`
 * so any client could POST arbitrary strings as `keyEncrypted` and
 * `address`. That leaves three concrete attack shapes:
 *   1. Denial-of-service via multi-megabyte `keyEncrypted` strings
 *      hitting DB write amplification.
 *   2. Planting malformed records that crash downstream decrypters.
 *   3. Forging a non-Solana string as the `address`, which later gets
 *      joined into cache keys, log lines and external lookups.
 */

/**
 * Solana base58 pubkey: 32 bytes → 43 or 44 chars after encoding.
 * We keep the regex narrow (base58 alphabet, length 32-44) so odd
 * inputs like `'\n'` or unicode homoglyphs are rejected early.
 */
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Base64 alphabet plus the two padding rules. Accepts URL-safe too. */
const BASE64_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;

/**
 * Upper bound for the ciphertext we're willing to persist. The legit
 * payload for XChaCha20-Poly1305 of a 32-byte seed + 24-byte nonce +
 * 16-byte tag + scrypt params is well under 1 KB. Allow 4 KB as
 * slack; anything larger is almost certainly abuse.
 */
export const MAX_KEY_ENCRYPTED_CHARS = 4096;

/** Below this length the payload can't possibly be valid ciphertext. */
export const MIN_KEY_ENCRYPTED_CHARS = 32;

export interface KeyUploadValidation {
  ok: boolean;
  reason?: string;
}

export function validateKeyUpload(
  keyEncrypted: unknown,
  address: unknown,
): KeyUploadValidation {
  if (typeof keyEncrypted !== 'string') {
    return { ok: false, reason: 'key_encrypted must be a string' };
  }
  if (
    keyEncrypted.length < MIN_KEY_ENCRYPTED_CHARS ||
    keyEncrypted.length > MAX_KEY_ENCRYPTED_CHARS
  ) {
    return {
      ok: false,
      reason: `key_encrypted length must be in [${MIN_KEY_ENCRYPTED_CHARS}, ${MAX_KEY_ENCRYPTED_CHARS}]`,
    };
  }
  if (!BASE64_RE.test(keyEncrypted)) {
    return {
      ok: false,
      reason: 'key_encrypted must be base64 / base64url',
    };
  }
  if (typeof address !== 'string') {
    return { ok: false, reason: 'address must be a string' };
  }
  if (!SOLANA_ADDRESS_RE.test(address)) {
    return {
      ok: false,
      reason: 'address must be a valid Solana base58 pubkey',
    };
  }
  return { ok: true };
}
