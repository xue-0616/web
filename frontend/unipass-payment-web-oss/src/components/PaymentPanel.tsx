import { useCallback, useState } from "react";

import { chainLabel, formatAmount, shortAddress, type PaymentRequest } from "@/lib/payment";
import { classifyError, type SendPhase, type Wallet } from "@/lib/wallet";

export interface PaymentPanelProps {
  request: PaymentRequest;
  /** Injected for tests. Defaults to the real (not-yet-wired) SDK. */
  wallet?: Wallet;
  /** Token metadata resolver. Injected in tests; real app reads from an indexer. */
  resolveTokenMeta?: (chainId: number, token: string | null) => Promise<{ symbol: string; decimals: number }>;
}

const DEFAULT_NATIVE_META: Record<number, { symbol: string; decimals: number }> = {
  1: { symbol: "ETH", decimals: 18 },
  10: { symbol: "ETH", decimals: 18 },
  56: { symbol: "BNB", decimals: 18 },
  137: { symbol: "MATIC", decimals: 18 },
  42161: { symbol: "ETH", decimals: 18 },
  8453: { symbol: "ETH", decimals: 18 },
};

async function defaultResolveTokenMeta(chainId: number, token: string | null) {
  if (token === null) return DEFAULT_NATIVE_META[chainId] ?? { symbol: "ETH", decimals: 18 };
  // A real deployment reads symbol/decimals from the token contract or a
  // cached indexer; for the scaffold we fall back to USDC defaults.
  return { symbol: "USDC", decimals: 6 };
}

export function PaymentPanel({ request, wallet, resolveTokenMeta }: PaymentPanelProps) {
  const [phase, setPhase] = useState<SendPhase>({ kind: "idle" });
  const [meta, setMeta] = useState<{ symbol: string; decimals: number } | null>(null);

  // Resolve token metadata once on mount.
  useState(() => {
    (resolveTokenMeta ?? defaultResolveTokenMeta)(request.chain, request.token).then(setMeta);
  });

  const onApprove = useCallback(async () => {
    if (!wallet) {
      setPhase({
        kind: "error",
        message: "Wallet not configured. Link @unipass/wallet-js in Phase 6 wiring.",
        cause: "unknown",
      });
      return;
    }
    try {
      if (!(await wallet.isConnected())) {
        setPhase({ kind: "connecting" });
        await wallet.connect();
      }
      setPhase({ kind: "confirming" });
      const { txHash } = await wallet.sendPayment(request);
      setPhase({ kind: "sent", txHash });
    } catch (e) {
      setPhase(classifyError(e));
    }
  }, [wallet, request]);

  const disabled = phase.kind === "connecting" || phase.kind === "confirming" || phase.kind === "broadcasting";

  return (
    <article
      style={{
        maxWidth: "28rem",
        width: "100%",
        padding: "2rem",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "1rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <h1 style={{ margin: 0 }}>Confirm payment</h1>
      <dl style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem 1rem", margin: "1.5rem 0" }}>
        <dt style={{ color: "#6b7280" }}>To</dt>
        <dd style={{ margin: 0 }} title={request.to}>{shortAddress(request.to)}</dd>

        <dt style={{ color: "#6b7280" }}>Network</dt>
        <dd style={{ margin: 0 }}>{chainLabel(request.chain)}</dd>

        <dt style={{ color: "#6b7280" }}>Amount</dt>
        <dd style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
          {meta
            ? formatAmount(request.amount, meta.decimals, meta.symbol)
            : `${request.amount} (pending metadata)`}
        </dd>

        {request.memo ? (
          <>
            <dt style={{ color: "#6b7280" }}>Memo</dt>
            <dd style={{ margin: 0 }}>{request.memo}</dd>
          </>
        ) : null}
      </dl>

      <PhaseBanner phase={phase} />

      {phase.kind === "sent" ? (
        <p style={{ color: "#16a34a" }}>
          Sent: <code data-testid="tx-hash">{phase.txHash}</code>
        </p>
      ) : (
        <button
          type="button"
          onClick={onApprove}
          disabled={disabled}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            background: "#6d28d9",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            cursor: disabled ? "wait" : "pointer",
            fontWeight: 600,
          }}
        >
          {disabled ? "Please wait…" : "Approve & send"}
        </button>
      )}
    </article>
  );
}

function PhaseBanner({ phase }: { phase: SendPhase }) {
  if (phase.kind === "idle" || phase.kind === "sent") return null;
  if (phase.kind === "error") {
    const msg =
      phase.cause === "user_rejected"
        ? "Cancelled — you declined the signature."
        : phase.cause === "insufficient_funds"
          ? "Insufficient funds to cover the transfer + gas."
          : phase.message;
    return (
      <p role="alert" style={{ color: "#dc2626" }}>
        {msg}
      </p>
    );
  }
  const label =
    phase.kind === "connecting" ? "Opening UniPass…" : phase.kind === "confirming" ? "Awaiting signature…" : "Broadcasting…";
  return <p aria-live="polite">{label}</p>;
}
