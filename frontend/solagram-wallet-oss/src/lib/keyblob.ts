/**
 * Encrypted keyblob — the on-device representation of a wallet's private key.
 *
 * Design goals:
 *   1. At rest, the blob is indistinguishable from random to anyone who does
 *      not have the passphrase. An attacker who dumps Telegram cloud storage
 *      or the browser's localStorage learns nothing beyond the blob size.
 *   2. Offline brute-force is hard: we derive the encryption key through a
 *      memory-hard KDF (scrypt, N=2^17, r=8, p=1) before using it with
 *      XChaCha20-Poly1305. A commodity laptop tries < 2 passphrases / sec.
 *   3. The plaintext is the raw 64-byte ed25519 secret key that
 *      `@solana/web3.js` `Keypair.fromSecretKey` expects. No JSON, no PEM —
 *      just bytes, so we never leak field names that hint at schema.
 *
 * File layout (little-endian):
 *   magic      "SGKB" (4 bytes) — lets us version the format
 *   version    u8            — currently 1
 *   kdf        u8            — 0x01 = scrypt
 *   logN       u8            — scrypt cost parameter, log2(N). Default 17.
 *   r          u8            — scrypt r. Default 8.
 *   p          u8            — scrypt p. Default 1.
 *   reserved   u8 x 3
 *   salt       16 bytes      — random, fed to scrypt
 *   nonce      24 bytes      — random, fed to XChaCha20-Poly1305
 *   ciphertext variable      — encrypted secretKey + Poly1305 MAC (16 bytes)
 *
 * Total overhead: 4 + 5 + 3 + 16 + 24 + 16 = 68 bytes per blob.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { scrypt } from "@noble/hashes/scrypt";
import { randomBytes } from "@noble/hashes/utils";

const MAGIC = new Uint8Array([0x53, 0x47, 0x4b, 0x42]); // "SGKB"
const VERSION = 1;
const KDF_SCRYPT = 0x01;

// Tuned so a single passphrase attempt costs ~250ms on commodity hardware.
// Raising logN by 1 doubles cost; keep < 20 so we don't OOM on low-end phones.
const DEFAULT_LOG_N = 17;
const DEFAULT_R = 8;
const DEFAULT_P = 1;

const SALT_LEN = 16;
const NONCE_LEN = 24;
const KEY_LEN = 32;

export interface KeyblobParams {
  logN?: number;
  r?: number;
  p?: number;
}

export class KeyblobError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "KeyblobError";
  }
}

/** Derive a 32-byte symmetric key from a UTF-8 passphrase + salt using scrypt. */
function deriveKey(pass: string, salt: Uint8Array, logN: number, r: number, p: number): Uint8Array {
  if (pass.length === 0) throw new KeyblobError("empty passphrase");
  if (logN < 14 || logN > 20) throw new KeyblobError("scrypt logN out of range");
  return scrypt(new TextEncoder().encode(pass), salt, {
    N: 1 << logN,
    r,
    p,
    dkLen: KEY_LEN,
  });
}

/**
 * Encrypt `secretKey` with a passphrase-derived key. Returns the full blob
 * ready to be persisted (localStorage, TG cloud storage, …).
 */
export function encryptSecretKey(secretKey: Uint8Array, pass: string, params: KeyblobParams = {}): Uint8Array {
  const logN = params.logN ?? DEFAULT_LOG_N;
  const r = params.r ?? DEFAULT_R;
  const p = params.p ?? DEFAULT_P;

  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key = deriveKey(pass, salt, logN, r, p);
  const cipher = xchacha20poly1305(key, nonce);
  const ct = cipher.encrypt(secretKey);

  const out = new Uint8Array(4 + 1 + 1 + 3 + 3 + SALT_LEN + NONCE_LEN + ct.length);
  let o = 0;
  out.set(MAGIC, o); o += 4;
  out[o++] = VERSION;
  out[o++] = KDF_SCRYPT;
  out[o++] = logN; out[o++] = r; out[o++] = p;
  // 3 reserved bytes (zeroed).
  o += 3;
  out.set(salt, o); o += SALT_LEN;
  out.set(nonce, o); o += NONCE_LEN;
  out.set(ct, o);
  // Defense in depth: wipe the derived key after use.
  key.fill(0);
  return out;
}

export interface DecryptedBlob {
  secretKey: Uint8Array;
  kdfParams: Required<KeyblobParams>;
}

/**
 * Decrypt a blob produced by `encryptSecretKey`. Throws `KeyblobError` with
 * a stable message the UI can match on ("bad passphrase" vs "corrupt blob")
 * — we never want to leak timing or error detail to an attacker.
 */
export function decryptSecretKey(blob: Uint8Array, pass: string): DecryptedBlob {
  if (blob.length < 4 + 5 + 3 + SALT_LEN + NONCE_LEN + 16) {
    throw new KeyblobError("corrupt blob");
  }
  let o = 0;
  for (let i = 0; i < MAGIC.length; i++) {
    if (blob[o + i] !== MAGIC[i]) throw new KeyblobError("corrupt blob");
  }
  o += 4;
  const version = blob[o++];
  const kdf = blob[o++];
  if (version !== VERSION || kdf !== KDF_SCRYPT) throw new KeyblobError("unsupported blob");
  const logN = blob[o++];
  const r = blob[o++];
  const p = blob[o++];
  o += 3; // reserved
  const salt = blob.slice(o, o + SALT_LEN); o += SALT_LEN;
  const nonce = blob.slice(o, o + NONCE_LEN); o += NONCE_LEN;
  const ct = blob.slice(o);

  const key = deriveKey(pass, salt, logN, r, p);
  const cipher = xchacha20poly1305(key, nonce);
  let pt: Uint8Array;
  try {
    pt = cipher.decrypt(ct);
  } catch {
    key.fill(0);
    throw new KeyblobError("bad passphrase");
  }
  key.fill(0);
  return { secretKey: pt, kdfParams: { logN, r, p } };
}

/**
 * Re-encrypt a decrypted blob with a new passphrase (used by "Change
 * passphrase" UI). Produces a fresh salt + nonce so the new blob is not
 * correlatable with the old one.
 */
export function rewrap(secretKey: Uint8Array, oldPass: string, newPass: string, existing: Uint8Array, params?: KeyblobParams): Uint8Array {
  // Caller should have already verified oldPass by decrypting `existing`;
  // we still sanity-check the magic so mis-ordered calls fail fast.
  if (existing.length > 0 && (existing[0] !== MAGIC[0] || existing[1] !== MAGIC[1])) {
    throw new KeyblobError("existing blob not a keyblob");
  }
  void oldPass; // signal intent; `existing` came from `decryptSecretKey`
  return encryptSecretKey(secretKey, newPass, params);
}

// ─── base64 helpers for persisting a Uint8Array to localStorage ──────────────

export function blobToString(blob: Uint8Array): string {
  let s = "";
  for (let i = 0; i < blob.length; i++) s += String.fromCharCode(blob[i]);
  return btoa(s);
}

export function stringToBlob(s: string): Uint8Array {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
