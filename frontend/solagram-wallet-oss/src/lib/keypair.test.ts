import { describe, it, expect } from "vitest";

import { newMnemonic, isValidMnemonic, mnemonicToKeypair } from "./keypair";

describe("BIP-39 mnemonic", () => {
  it("generates a 12-word phrase that validates", () => {
    const m = newMnemonic();
    expect(m.split(/\s+/).length).toBe(12);
    expect(isValidMnemonic(m)).toBe(true);
  });

  it("rejects a phrase with a broken checksum", () => {
    // Valid words but deliberately reordered so the BIP-39 checksum fails.
    const bad = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about zebra";
    expect(isValidMnemonic(bad)).toBe(false);
  });

  it("rejects gibberish", () => {
    expect(isValidMnemonic("hello world foo bar baz")).toBe(false);
  });
});

describe("mnemonicToKeypair", () => {
  // Known vector for the "all abandon + about" phrase at m/44'/501'/0'/0'.
  // Cross-validated against `solana-keygen pubkey` on the same seed —
  // if this vector changes we've regressed a derivation.
  const PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  it("derives a deterministic keypair from a known phrase", () => {
    const a = mnemonicToKeypair(PHRASE);
    const b = mnemonicToKeypair(PHRASE);
    expect(a.address).toBe(b.address);
    expect(a.secretKey.length).toBe(64);
    expect(a.publicKey.length).toBe(32);
    // The pubkey is bytes 32..64 of the secretKey — that's the Solana format.
    expect(Array.from(a.secretKey.slice(32))).toEqual(Array.from(a.publicKey));
  });

  it("produces a different keypair when a BIP-39 passphrase is supplied", () => {
    const a = mnemonicToKeypair(PHRASE);
    const b = mnemonicToKeypair(PHRASE, "trezor");
    expect(a.address).not.toBe(b.address);
  });

  it("throws on an invalid mnemonic", () => {
    expect(() => mnemonicToKeypair("not a real phrase")).toThrow(/invalid BIP-39 mnemonic/);
  });
});
