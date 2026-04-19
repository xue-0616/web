import { useState } from "react";

/**
 * New-token launch form. Validates metadata client-side; on submit we
 * would call `pumpdotfun-sdk::createAndBuy({ name, symbol, uri, amount })`,
 * which builds the on-chain tx. Here we just show the would-be payload
 * so UX can be tested without a wallet.
 */
export function LaunchForm() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("🚀");
  const [devBuy, setDevBuy] = useState("0.5");
  const [submitted, setSubmitted] = useState<null | Record<string, string>>(null);

  const errors = {
    name: name.length < 2 || name.length > 32,
    symbol: !/^[A-Z0-9]{2,10}$/.test(symbol),
    desc: desc.length > 280,
    buy: !(Number.parseFloat(devBuy) >= 0),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) return;
    setSubmitted({ name, symbol, emoji, description: desc, devBuySol: devBuy });
  };

  return (
    <form className="launch" onSubmit={submit}>
      <header>
        <h2>Launch a coin</h2>
        <p>Creates a new bonding-curve token on Solana. Cost: 0.02 SOL rent + optional dev buy.</p>
      </header>

      <div className="grid">
        <label>
          <span>Name <em>{name.length}/32</em></span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Degen Kitten" />
          {errors.name && name.length > 0 && <small className="err">2–32 chars required.</small>}
        </label>
        <label>
          <span>Ticker</span>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="DKITTY" />
          {errors.symbol && symbol.length > 0 && <small className="err">2–10 A–Z/0–9 chars.</small>}
        </label>
        <label className="full">
          <span>Emoji</span>
          <input className="emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        </label>
        <label className="full">
          <span>Description <em>{desc.length}/280</em></span>
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="One-liner so buyers know what to think." />
        </label>
        <label className="full">
          <span>Initial dev buy (SOL)</span>
          <input type="number" min="0" step="0.01" value={devBuy} onChange={(e) => setDevBuy(e.target.value)} />
          <small className="dim">Optional. Auto-buys this much of the curve with your launch tx. Gives a price floor.</small>
        </label>
      </div>

      <button type="submit" className="launch-btn" disabled={hasErrors || !name || !symbol}>
        {hasErrors ? "Fix errors above" : `Launch ${symbol || "coin"} →`}
      </button>

      {submitted && (
        <pre className="preview">Would call pumpdotfun-sdk.createAndBuy({JSON.stringify(submitted, null, 2)})</pre>
      )}

      <style>{`
        .launch { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-6); }
        header h2 { margin: 0; font-size: var(--text-3xl); letter-spacing: -0.02em; }
        header p { margin: var(--space-2) 0 0; color: var(--fg-dim); }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        .grid label.full { grid-column: 1 / -1; }
        label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); color: var(--fg-dim); }
        label span { display: flex; justify-content: space-between; }
        label em { color: var(--muted); font-style: normal; }
        input, textarea {
          padding: var(--space-3); border-radius: var(--radius-md);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--fg);
        }
        input.emoji { font-size: var(--text-2xl); width: 72px; text-align: center; }
        input:focus, textarea:focus { border-color: var(--accent); outline: none; }
        .err { color: var(--loss); font-size: var(--text-xs); }
        .dim { color: var(--muted); font-size: var(--text-xs); }
        .launch-btn {
          padding: var(--space-4); border-radius: var(--radius-md);
          background: var(--accent); color: var(--accent-fg);
          font-weight: 700; font-size: var(--text-base);
        }
        .launch-btn:hover:not(:disabled) { background: var(--accent-hover); }
        .launch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .preview {
          margin: 0; padding: var(--space-4);
          background: var(--surface-2); border-radius: var(--radius-md);
          font-family: var(--font-mono); font-size: var(--text-xs);
          color: var(--fg-dim); overflow-x: auto;
        }
      `}</style>
    </form>
  );
}
