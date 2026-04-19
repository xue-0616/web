/**
 * Client for `backend-rust/unipass-snap-service-oss` (see that crate's
 * README for the HTTP contract). All response shapes below are verified
 * against the actix-web handlers in `src/api/mod.rs`.
 *
 * Envelope: every success body is `{ "code": 0, "data": <T> }`.
 * Errors come through `ResponseError`, which always returns a JSON
 * body shaped like `{ "code": <status>, "message": "<str>" }`.
 */

export interface LoginChallenge {
  nonce: string;
  ttlSecs: number;
}

export interface TxHistoryItem {
  id: number;
  chainId: number;
  nonce: number;
  status: number;
  transactionHash: string | null;
  createdAt: string;
}

export interface AccountInfo {
  id: number;
  walletAddress: string;
  providerType: "snap" | "google";
  providerIdentifier: string;
  guideStatus: "not_start" | "finish";
}

export interface SnapServiceBackend {
  loginChallenge(walletAddress: string): Promise<LoginChallenge>;
  login(
    walletAddress: string,
    providerType: "snap" | "google",
    providerIdentifier: string,
    signatureHex: string,
    nonce: string,
  ): Promise<string /* jwt */>;
  me(jwt: string): Promise<AccountInfo>;
  setGuideStatus(jwt: string, finished: boolean): Promise<void>;
  txHistory(jwt: string, limit: number): Promise<TxHistoryItem[]>;
}

/** Standard error shape the snap-service emits. */
export class SnapServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "SnapServiceError";
  }
}

/** Unwrap the `{ code, data }` envelope, raising on non-zero `code`. */
interface Envelope<T> {
  code?: number;
  data?: T;
  message?: string;
}

export async function unwrapEnvelope<T>(resp: Response): Promise<T> {
  let body: Envelope<T> | null = null;
  try {
    body = (await resp.json()) as Envelope<T>;
  } catch {
    throw new SnapServiceError(resp.status, `HTTP ${resp.status}: malformed JSON`);
  }
  if (!resp.ok) {
    throw new SnapServiceError(
      resp.status,
      body?.message ?? `HTTP ${resp.status}`,
      body?.code,
    );
  }
  if (body?.code !== 0 || body.data === undefined) {
    throw new SnapServiceError(
      resp.status,
      body?.message ?? "envelope error",
      body?.code,
    );
  }
  return body.data;
}

export function createSnapService(baseUrl: string): SnapServiceBackend {
  const call = async <T>(path: string, init: RequestInit): Promise<T> => {
    const resp = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    return unwrapEnvelope<T>(resp);
  };

  return {
    async loginChallenge(walletAddress) {
      const raw = await call<{ nonce: string; ttl_secs: number }>(
        "/v1/account/login_challenge",
        { method: "POST", body: JSON.stringify({ wallet_address: walletAddress }) },
      );
      return { nonce: raw.nonce, ttlSecs: raw.ttl_secs };
    },
    async login(walletAddress, providerType, providerIdentifier, signatureHex, nonce) {
      const raw = await call<{ token: string }>("/v1/account/login", {
        method: "POST",
        body: JSON.stringify({
          wallet_address: walletAddress,
          provider_type: providerType,
          provider_identifier: providerIdentifier,
          signature: signatureHex,
          nonce,
        }),
      });
      return raw.token;
    },
    async me(jwt) {
      return call<AccountInfo>("/v1/account/me", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
    },
    async setGuideStatus(jwt, finished) {
      await call<unknown>("/v1/account/guide_status", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ finished }),
      });
    },
    async txHistory(jwt, limit) {
      const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
      return call<TxHistoryItem[]>(`/v1/tx/history?limit=${safeLimit}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
    },
  };
}
