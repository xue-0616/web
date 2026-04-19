import { Wallet } from "ethers";
import { syncScrypt } from "scrypt-js";
import { concat, hexlify, arrayify, keccak256, toUtf8Bytes } from "ethers/lib/utils";

export async function signMsg(
  msg: string,
  privkey: string,
  isArrayify: boolean
): Promise<string> {
  const w = new Wallet(privkey);
  const sig = await w.signMessage(isArrayify ? arrayify(msg) : msg);
  return sig;
}

export const generateKdfPassword = (password: string, email?: string): string => {
  // Derive a user-specific salt from email to avoid using a static salt.
  // Falls back to a default if email is not provided for backward compatibility.
  const saltInput = email ? `unipass-wallet:${email}` : "hello unipass wallet";
  const salt = keccak256(toUtf8Bytes(saltInput));
  const N = 2 ** 17; // 131072 — OWASP recommended minimum for scrypt
  const r = 8;
  const p = 1;
  const dkLen = 32;
  const passwordBuffer = Buffer.from(password, "utf-8");
  const saltBuffer = Buffer.from(arrayify(salt));
  const derivedKey = syncScrypt(passwordBuffer, saltBuffer, N, r, p, dkLen);
  return hexlify(
    concat([hexlify(new Uint8Array(saltBuffer)), hexlify(derivedKey)])
  );
};
