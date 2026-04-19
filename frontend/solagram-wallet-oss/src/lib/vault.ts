/**
 * Vault — the user-facing wrapper around `keyblob.ts` + `keypair.ts`.
 *
 * Responsibilities:
 *   - Persist the encrypted blob to localStorage (browser) or the TG cloud
 *     storage API (inside Telegram). The key name is a constant.
 *   - Expose three high-level operations: `create`, `unlock`, `lock`.
 *   - Cache the decrypted keypair in memory only while the wallet is
 *     unlocked, and scrub it on `lock()`.
 *
 * What this module deliberately DOES NOT do:
 *   - Sign transactions. That lives in a separate `signer.ts` so this
 *     module stays purely about storage + crypto.
 *   - Remember the passphrase. Ever. If the user locks the wallet they
 *     must re-enter it to unlock.
 */

import { encryptSecretKey, decryptSecretKey, blobToString, stringToBlob, KeyblobError } from "./keyblob";
import { mnemonicToKeypair, newMnemonic, isValidMnemonic, type SolanaKeypair } from "./keypair";

const STORAGE_KEY = "solagram:wallet.v1";
const META_KEY = "solagram:wallet.meta"; // non-secret metadata (address only)

interface WalletMeta {
  address: string;
  createdAt: number;
}

/**
 * Write-through storage adapter. Falls back to localStorage when not
 * running inside Telegram. When inside TG we persist to the cloud store
 * so the keyblob survives a reinstall of the mini-app.
 */
interface TgCloudStorage {
  setItem: (k: string, v: string, cb?: (err: unknown) => void) => void;
  getItem: (k: string, cb: (err: unknown, v?: string) => void) => void;
  removeItem: (k: string, cb?: (err: unknown) => void) => void;
}
function tg(): TgCloudStorage | null {
  const w = window as unknown as { Telegram?: { WebApp?: { CloudStorage?: TgCloudStorage } } };
  return w.Telegram?.WebApp?.CloudStorage ?? null;
}

async function storeSet(key: string, value: string): Promise<void> {
  const cs = tg();
  if (!cs) { window.localStorage.setItem(key, value); return; }
  return new Promise((resolve, reject) => {
    cs.setItem(key, value, (err) => err ? reject(err) : resolve());
  });
}
async function storeGet(key: string): Promise<string | null> {
  const cs = tg();
  if (!cs) return window.localStorage.getItem(key);
  return new Promise((resolve, reject) => {
    cs.getItem(key, (err, v) => err ? reject(err) : resolve(v ?? null));
  });
}
async function storeRemove(key: string): Promise<void> {
  const cs = tg();
  if (!cs) { window.localStorage.removeItem(key); return; }
  return new Promise((resolve, reject) => {
    cs.removeItem(key, (err) => err ? reject(err) : resolve());
  });
}

// ─── public API ──────────────────────────────────────────────────────────────

export interface CreateOptions {
  /** Use this mnemonic instead of generating one (import flow). */
  mnemonic?: string;
  /** Optional BIP-39 passphrase — NOT the encryption passphrase. */
  bip39Passphrase?: string;
}

export interface CreateResult {
  mnemonic: string;
  address: string;
}

/** Generate (or import) a wallet and persist its encrypted blob. */
export async function createWallet(encryptionPass: string, opts: CreateOptions = {}): Promise<CreateResult> {
  const mnemonic = opts.mnemonic?.trim() || newMnemonic();
  if (opts.mnemonic && !isValidMnemonic(mnemonic)) throw new KeyblobError("invalid BIP-39 mnemonic");

  const kp = mnemonicToKeypair(mnemonic, opts.bip39Passphrase ?? "");
  const blob = encryptSecretKey(kp.secretKey, encryptionPass);
  await storeSet(STORAGE_KEY, blobToString(blob));
  await storeSet(META_KEY, JSON.stringify({ address: kp.address, createdAt: Date.now() } satisfies WalletMeta));
  // Scrub sensitive plaintext before returning. We keep `mnemonic` alive so
  // the onboarding UI can show it once — caller is expected to let it fall
  // out of scope immediately after.
  kp.secretKey.fill(0);
  return { mnemonic, address: kp.address };
}

/** Quick check that we have a blob on disk without needing the passphrase. */
export async function hasWallet(): Promise<boolean> {
  return (await storeGet(STORAGE_KEY)) !== null;
}

export async function readMeta(): Promise<WalletMeta | null> {
  const raw = await storeGet(META_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as WalletMeta; } catch { return null; }
}

/** Load + decrypt. Returns a live keypair the caller must `lock()` to zero. */
export async function unlockWallet(encryptionPass: string): Promise<SolanaKeypair & { lock: () => void }> {
  const raw = await storeGet(STORAGE_KEY);
  if (!raw) throw new KeyblobError("no wallet on device");
  const blob = stringToBlob(raw);
  const { secretKey } = decryptSecretKey(blob, encryptionPass);

  // Reconstruct public key + address from the 64-byte secretKey.
  const pub32 = secretKey.slice(32);
  const address = (await import("bs58")).default.encode(pub32);

  return {
    secretKey,
    publicKey: pub32,
    address,
    lock() {
      secretKey.fill(0);
      pub32.fill(0);
    },
  };
}

/** Re-encrypt the stored blob with a new passphrase. */
export async function changePassphrase(oldPass: string, newPass: string): Promise<void> {
  const raw = await storeGet(STORAGE_KEY);
  if (!raw) throw new KeyblobError("no wallet on device");
  const { secretKey } = decryptSecretKey(stringToBlob(raw), oldPass);
  const newBlob = encryptSecretKey(secretKey, newPass);
  secretKey.fill(0);
  await storeSet(STORAGE_KEY, blobToString(newBlob));
}

/** Nuke the wallet from storage. Irreversible — caller must confirm first. */
export async function destroyWallet(): Promise<void> {
  await storeRemove(STORAGE_KEY);
  await storeRemove(META_KEY);
}
