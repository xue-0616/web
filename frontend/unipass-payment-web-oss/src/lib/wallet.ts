/**
 * Narrow wallet interface the payment flow talks to.
 *
 * The real implementation in production is backed by `@unipass/wallet-js`
 * (the SDK we mirror in `frontend/unipass-wallet-js-oss`). Exposing a
 * trait rather than importing the SDK directly keeps the payment
 * component testable (inject a fake) and swappable (WalletConnect /
 * EIP-1193 / native browser wallet).
 */

import type { PaymentRequest } from "./payment";

export interface SendResult {
  /** `0x`-prefixed 32-byte transaction hash. */
  txHash: string;
}

export interface Wallet {
  /** Is a session currently active? */
  isConnected(): Promise<boolean>;
  /** Open the UniPass wallet session (email/OIDC flow). */
  connect(): Promise<{ address: string; chainId: number }>;
  /**
   * Sign + broadcast an ERC-20 (or native) transfer matching `req`.
   * Rejects with `user_rejected` if the user declines.
   */
  sendPayment(req: PaymentRequest): Promise<SendResult>;
}

/** Human-friendly classification of wallet errors. */
export type SendPhase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "confirming" }
  | { kind: "broadcasting" }
  | { kind: "sent"; txHash: string }
  | { kind: "error"; message: string; cause: "user_rejected" | "insufficient_funds" | "unknown" };

/** Map a thrown error from the wallet SDK into a SendPhase error. */
export function classifyError(e: unknown): SendPhase {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user_rejected") || lower.includes("denied")) {
    return { kind: "error", message: msg, cause: "user_rejected" };
  }
  if (lower.includes("insufficient funds") || lower.includes("insufficient_funds")) {
    return { kind: "error", message: msg, cause: "insufficient_funds" };
  }
  return { kind: "error", message: msg, cause: "unknown" };
}
