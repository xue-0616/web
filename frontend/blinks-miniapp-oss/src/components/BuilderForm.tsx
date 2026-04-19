"use client";
import { useState } from "react";

const SAMPLE = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp9PVbYDQ7F6wV";
const PRESETS = [0.01, 0.05, 0.1, 0.5];

/**
 * Client-side URL builder. Writes the resulting GET-endpoint URL to
 * localStorage under `blink:preview-url` so the paired BlinkPreview
 * component picks it up (no prop-drilling, both are independent
 * islands on the page).
 */
export function BuilderForm() {
  const [recipient, setRecipient] = useState(SAMPLE);
  const [amount, setAmount] = useState(0.01);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/actions/tip?recipient=${recipient}&amount=${amount}`;

  const apply = () => {
    window.localStorage.setItem("blink:preview-url", url);
    window.dispatchEvent(new Event("blink:url-changed"));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); apply(); }}>
      <h2>Build your Blink</h2>
      <p className="dim">Any Solana Action URL can be rendered as a Blink in-feed.</p>

      <label>
        <span>Recipient address</span>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="base58 Solana address"
          spellCheck={false}
        />
      </label>

      <label>
        <span>Amount (SOL)</span>
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p}
              className={`preset ${amount === p ? "on" : ""}`}
              onClick={() => setAmount(p)}
            >{p}</button>
          ))}
          <input
            type="number"
            min="0.0001"
            step="0.0001"
            value={amount}
            onChange={(e) => setAmount(Number.parseFloat(e.target.value) || 0)}
          />
        </div>
      </label>

      <div className="url-row">
        <code className="url">{url || "(loading…)"}</code>
        <button type="button" className="secondary" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <button type="submit" className="primary">Apply to preview →</button>

      <style jsx>{`
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          display: flex; flex-direction: column; gap: var(--space-4);
        }
        h2 { margin: 0; font-size: var(--text-xl); }
        .dim { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); }
        label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); }
        label > span { color: var(--fg-dim); }
        input[type="text"], input[type="number"] {
          padding: var(--space-3); background: var(--surface-2);
          border: 1px solid var(--border); border-radius: var(--radius-md);
          color: var(--fg); font-family: var(--font-mono);
        }
        input:focus { border-color: var(--accent); outline: none; }
        .preset-row { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }
        .preset {
          padding: var(--space-2) var(--space-4); border-radius: var(--radius-full);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--fg-dim); font-size: var(--text-sm);
        }
        .preset.on { background: var(--accent-ghost); border-color: var(--accent); color: var(--accent); }
        .preset-row input[type="number"] { flex: 1; min-width: 120px; }
        .url-row { display: flex; gap: var(--space-2); align-items: stretch; }
        .url {
          flex: 1; padding: var(--space-3); background: var(--surface-2);
          border: 1px solid var(--border); border-radius: var(--radius-md);
          font-size: var(--text-xs); overflow-x: auto; white-space: nowrap;
        }
        .secondary, .primary {
          padding: var(--space-3) var(--space-5); border-radius: var(--radius-md);
          font-weight: 600; font-size: var(--text-sm);
        }
        .secondary { background: var(--surface-2); color: var(--fg); border: 1px solid var(--border); }
        .primary { background: var(--accent); color: var(--accent-fg); }
        .primary:hover { background: var(--accent-hover); }
      `}</style>
    </form>
  );
}
