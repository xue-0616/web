/**
 * JSON-RPC client for `backend-rust/paymaster-service-oss` — the
 * ERC-4337 VerifyingPaymaster sponsor.
 *
 * Exposes two methods, matching the closed-source ELF + the OSS Rust
 * rewrite at `backend-rust/paymaster-service-oss/src/rpc.rs`:
 *
 *   * `pm_supportedEntryPoints()`        → string[] (0x-prefixed addresses)
 *   * `pm_sponsorUserOperation(op, ep)`  → `{ paymasterAndData }`
 *
 * All params follow ERC-4337 v0.6 hex-encoded quantities.
 */

/** Minimum set of ERC-4337 v0.6 UserOperation fields we forward. */
export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export interface SponsorResult {
  /** 149-byte hex-encoded concatenation of paymaster addr + validUntil + validAfter + sig. */
  paymasterAndData: string;
}

export class PaymasterError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
    this.name = "PaymasterError";
  }
}

export interface PaymasterBackend {
  supportedEntryPoints(): Promise<string[]>;
  sponsorUserOperation(op: UserOperation, entryPoint: string): Promise<SponsorResult>;
}

export function createPaymasterClient(rpcUrl: string): PaymasterBackend {
  let id = 0;
  const rpc = async <R>(method: string, params: unknown[]): Promise<R> => {
    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    if (!resp.ok) {
      throw new PaymasterError(resp.status, `HTTP ${resp.status}`);
    }
    const body = (await resp.json()) as {
      result?: R;
      error?: { code: number; message: string };
    };
    if (body.error) {
      throw new PaymasterError(body.error.code, body.error.message);
    }
    if (body.result === undefined) {
      throw new PaymasterError(-32603, "missing result in response");
    }
    return body.result;
  };

  return {
    supportedEntryPoints() {
      return rpc<string[]>("pm_supportedEntryPoints", []);
    },
    sponsorUserOperation(op, entryPoint) {
      return rpc<SponsorResult>("pm_sponsorUserOperation", [op, entryPoint]);
    },
  };
}

/** Shape-check a UserOperation before it leaves the client. */
export function validateUserOp(op: Partial<UserOperation>): op is UserOperation {
  const fields: (keyof UserOperation)[] = [
    "sender", "nonce", "initCode", "callData",
    "callGasLimit", "verificationGasLimit", "preVerificationGas",
    "maxFeePerGas", "maxPriorityFeePerGas", "paymasterAndData", "signature",
  ];
  for (const f of fields) {
    const v = op[f];
    if (typeof v !== "string" || !v.startsWith("0x")) return false;
  }
  return true;
}
