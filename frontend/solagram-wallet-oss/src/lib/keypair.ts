/**
 * BIP-39 mnemonic + ed25519 keypair helpers.
 *
 * Solana uses ed25519 with the SLIP-0010 derivation path
 *   m/44'/501'/0'/0'
 * Phantom, Solflare and most wallets follow the same path so our seed
 * phrases remain interoperable. If the user imports a 24-word phrase we
 * accept it too (BIP-39 allows 12/15/18/21/24 word lists).
 *
 * NOTE: we deliberately avoid `@solana/web3.js` `Keypair.generate()` —
 * that generates from `nacl.sign.keyPair()` and cannot be re-derived
 * from a seed phrase. Deriving from BIP-39 lets users back-up once and
 * recover on any Solana wallet.
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";

export const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

/** 12-word mnemonic (128 bits of entropy). */
export function newMnemonic(strength = 128): string {
  return generateMnemonic(wordlist, strength);
}

export function isValidMnemonic(m: string): boolean {
  return validateMnemonic(m.trim(), wordlist);
}

export interface SolanaKeypair {
  /** 64-byte secret key (32-byte seed ‖ 32-byte public key) — the format
   *  `Keypair.fromSecretKey` wants. */
  secretKey: Uint8Array;
  /** 32-byte raw public key. */
  publicKey: Uint8Array;
  /** base58-encoded public key, i.e. the wallet address. */
  address: string;
}

/**
 * Derive the wallet's keypair at `m/44'/501'/0'/0'` from a mnemonic.
 * Passing an optional BIP-39 passphrase lets users layer an extra secret
 * on top of the seed phrase (same as hardware wallets' "25th word").
 */
export function mnemonicToKeypair(mnemonic: string, bip39Pass = ""): SolanaKeypair {
  if (!isValidMnemonic(mnemonic)) {
    throw new Error("invalid BIP-39 mnemonic");
  }
  const seed = mnemonicToSeedSync(mnemonic.trim(), bip39Pass);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(SOLANA_DERIVATION_PATH);
  if (!child.privateKey) throw new Error("derivation produced no private key");

  const priv32 = child.privateKey; // 32-byte seed for ed25519
  const pub32 = ed25519.getPublicKey(priv32);

  const secretKey = new Uint8Array(64);
  secretKey.set(priv32, 0);
  secretKey.set(pub32, 32);

  return {
    secretKey,
    publicKey: pub32,
    address: bs58.encode(pub32),
  };
}
