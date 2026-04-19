import { useState } from "react";

/**
 * Receive screen — QR code via the public quickchart.io service with a
 * built-in fallback pattern (so the preview works offline). Production
 * would generate the QR locally using `qrcode` or similar; kept as
 * network-fetch for UI polish while the scaffold has no npm install.
 */
export function Receive({ address, onBack }: { address: string; onBack: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const qr = `https://quickchart.io/qr?text=${encodeURIComponent(address)}&size=240&dark=0a0a0f&light=ffffff`;

  return (
    <section className="receive">
      <button className="back" onClick={onBack}>← Back</button>
      <h2>Receive SOL or tokens</h2>
      <p>Anyone can send SPL tokens to this address. Tokens with unknown mints appear after first transfer.</p>

      <div className="qr">
        <img src={qr} alt="QR code for wallet address" width={240} height={240} onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }} />
        <div className="qr-fallback" aria-hidden>
          {/* Stylised fallback pattern when QR service unreachable */}
          {Array.from({ length: 21 * 21 }).map((_, i) => {
            const on = ((address.charCodeAt(i % address.length) + i) % 3) !== 0;
            return <span key={i} className={on ? "on" : ""} />;
          })}
        </div>
      </div>

      <button className="addr" onClick={copy}>
        <span className="mono">{address}</span>
        <span className="hint">{copied ? "✓ Copied" : "⧉ Copy"}</span>
      </button>

      <div className="warn">
        <strong>⚠️ Solana only.</strong> Sending Ethereum or Bitcoin assets
        to this address will result in permanent loss.
      </div>

      <style>{`
        .receive { display: flex; flex-direction: column; gap: var(--space-4); }
        .back { align-self: flex-start; padding: var(--space-2); color: var(--fg-dim); }
        .back:hover { color: var(--fg); }
        h2 { margin: 0; font-size: var(--text-2xl); }
        p { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); }
        .qr {
          position: relative;
          align-self: center; padding: var(--space-4);
          background: #ffffff; border-radius: var(--radius-lg);
          width: 272px; height: 272px;
        }
        .qr img { display: block; }
        .qr-fallback {
          position: absolute; inset: var(--space-4);
          display: grid; grid-template-columns: repeat(21, 1fr); gap: 0;
          z-index: -1;
        }
        .qr-fallback span { background: transparent; }
        .qr-fallback span.on { background: #0a0a0f; }
        .addr {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--radius-md); color: var(--fg);
          overflow: hidden;
        }
        .addr .mono { flex: 1; font-family: var(--font-mono); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
        .addr .hint { font-size: var(--text-xs); color: var(--accent); white-space: nowrap; }
        .warn {
          padding: var(--space-3) var(--space-4);
          background: color-mix(in srgb, var(--warn) 12%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--warn) 40%, var(--border));
          border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--fg-dim);
        }
        .warn strong { color: var(--warn); }
      `}</style>
    </section>
  );
}
