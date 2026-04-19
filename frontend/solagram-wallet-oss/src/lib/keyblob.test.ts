import { describe, it, expect } from "vitest";

import { encryptSecretKey, decryptSecretKey, KeyblobError, blobToString, stringToBlob } from "./keyblob";

/**
 * We use a *low* scrypt cost (logN=14) in tests because vitest runs CI with
 * a wall-clock budget and the defaults take ~250ms per call. Production
 * code paths stick with the DEFAULT_LOG_N=17 defined in keyblob.ts.
 */
const FAST = { logN: 14 };

const sampleSecretKey = () => {
  const out = new Uint8Array(64);
  for (let i = 0; i < 64; i++) out[i] = (i * 7 + 13) & 0xff;
  return out;
};

describe("keyblob", () => {
  it("round-trips a secret key with the correct passphrase", () => {
    const sk = sampleSecretKey();
    const blob = encryptSecretKey(sk, "correct-horse-battery", FAST);
    const { secretKey } = decryptSecretKey(blob, "correct-horse-battery");
    expect(Array.from(secretKey)).toEqual(Array.from(sk));
  });

  it("rejects a wrong passphrase with a stable message", () => {
    const sk = sampleSecretKey();
    const blob = encryptSecretKey(sk, "right-pass", FAST);
    expect(() => decryptSecretKey(blob, "wrong-pass")).toThrow(KeyblobError);
    expect(() => decryptSecretKey(blob, "wrong-pass")).toThrow(/bad passphrase/);
  });

  it("rejects a corrupted blob", () => {
    const sk = sampleSecretKey();
    const blob = encryptSecretKey(sk, "pw", FAST);
    const tampered = new Uint8Array(blob);
    tampered[tampered.length - 1] ^= 0xff; // flip the last byte of the MAC
    expect(() => decryptSecretKey(tampered, "pw")).toThrow(/bad passphrase/);
  });

  it("rejects a too-short blob without hanging on scrypt", () => {
    const tiny = new Uint8Array(10);
    expect(() => decryptSecretKey(tiny, "whatever")).toThrow(/corrupt blob/);
  });

  it("rejects an empty passphrase on encrypt", () => {
    expect(() => encryptSecretKey(sampleSecretKey(), "", FAST)).toThrow(/empty passphrase/);
  });

  it("produces different ciphertexts for the same plaintext (fresh salt+nonce)", () => {
    const sk = sampleSecretKey();
    const a = encryptSecretKey(sk, "pw", FAST);
    const b = encryptSecretKey(sk, "pw", FAST);
    // Same passphrase + plaintext → distinct blobs because salt and nonce are random.
    expect(blobToString(a)).not.toEqual(blobToString(b));
  });

  it("survives base64 round-trip through storage", () => {
    const sk = sampleSecretKey();
    const blob = encryptSecretKey(sk, "pw", FAST);
    const s = blobToString(blob);
    const back = stringToBlob(s);
    expect(Array.from(back)).toEqual(Array.from(blob));
    const { secretKey } = decryptSecretKey(back, "pw");
    expect(Array.from(secretKey)).toEqual(Array.from(sk));
  });

  it("enforces scrypt logN bounds", () => {
    expect(() => encryptSecretKey(sampleSecretKey(), "pw", { logN: 8 })).toThrow(/logN out of range/);
    expect(() => encryptSecretKey(sampleSecretKey(), "pw", { logN: 25 })).toThrow(/logN out of range/);
  });
});
