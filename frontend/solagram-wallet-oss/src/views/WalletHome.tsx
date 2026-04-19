import { useState } from "react";

import { AssetDetail } from "./AssetDetail";
import { Receive } from "./Receive";
import { Settings } from "./Settings";

const ASSETS = [
  { symbol: "SOL",  amount: 12.34,       usd: 2317.13, logo: "◎" },
  { symbol: "USDC", amount: 1240.00,     usd: 1240.00, logo: "💵" },
  { symbol: "JUP",  amount: 850.00,      usd: 1045.50, logo: "🪐" },
  { symbol: "BONK", amount: 12_500_000,  usd: 308.75,  logo: "🐕" },
];

type View =
  | { kind: "home" }
  | { kind: "receive" }
  | { kind: "settings" }
  | { kind: "asset"; symbol: string }
  | { kind: "send" }
  | { kind: "swap" };

export function WalletHome({ onLock }: { onLock?: () => void } = {}) {
  const [view, setView] = useState<View>({ kind: "home" });
  const total = ASSETS.reduce((s, a) => s + a.usd, 0);
  const address = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp9PVbYDQ7F6wV";

  if (view.kind === "receive") return <Receive address={address} onBack={() => setView({ kind: "home" })} />;
  if (view.kind === "settings") return <Settings onBack={() => setView({ kind: "home" })} onLock={() => onLock?.()} />;
  if (view.kind === "asset") {
    const a = ASSETS.find((x) => x.symbol === view.symbol)!;
    return <AssetDetail {...a} onBack={() => setView({ kind: "home" })} />;
  }
  if (view.kind === "send") return <SendForm onBack={() => setView({ kind: "home" })} />;
  if (view.kind === "swap") return <SwapInline onBack={() => setView({ kind: "home" })} />;

  return (
    <>
      <section className="balance">
        <div className="label">Total balance</div>
        <div className="amount">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <button className="addr" onClick={() => navigator.clipboard.writeText(address)} title="Copy address">
          {address.slice(0, 4)}…{address.slice(-4)} <span>⧉</span>
        </button>
      </section>

      <div className="quick">
        <QuickAction icon="↑" label="Send" onClick={() => setView({ kind: "send" })} />
        <QuickAction icon="↓" label="Receive" onClick={() => setView({ kind: "receive" })} />
        <QuickAction icon="↕" label="Swap" onClick={() => setView({ kind: "swap" })} />
        <QuickAction icon="⚙" label="Settings" onClick={() => setView({ kind: "settings" })} />
      </div>

      <h3>Assets</h3>
      <ul className="assets" role="list">
        {ASSETS.map((a) => (
          <li key={a.symbol}>
            <button onClick={() => setView({ kind: "asset", symbol: a.symbol })}>
              <div className="logo">{a.logo}</div>
              <div>
                <div className="sym">{a.symbol}</div>
                <div className="qty">{a.amount.toLocaleString()}</div>
              </div>
              <div className="usd">${a.usd.toFixed(2)}</div>
            </button>
          </li>
        ))}
      </ul>

      <style>{`
        .balance {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-6);
          text-align: center;
          background-image: radial-gradient(ellipse 60% 40% at 50% 0%, var(--accent-ghost), transparent);
        }
        .balance .label { color: var(--muted); font-size: var(--text-sm); }
        .balance .amount { font-size: var(--text-4xl); font-weight: 700; letter-spacing: -0.02em; margin: var(--space-2) 0; font-family: var(--font-mono); }
        .addr {
          font-family: var(--font-mono); font-size: var(--text-xs);
          color: var(--fg-dim);
          padding: var(--space-1) var(--space-3);
          border: 1px solid var(--border); border-radius: var(--radius-full);
        }
        .addr:hover { color: var(--fg); border-color: var(--accent); }

        .quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }

        h3 { margin: var(--space-4) 0 0; color: var(--muted); font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.05em; }

        .assets { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
        .assets li button {
          width: 100%; display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-md); color: var(--fg);
          text-align: left;
        }
        .assets li button:hover { border-color: var(--accent); }
        .logo { width: 40px; height: 40px; background: var(--surface-2); border-radius: var(--radius-md); display: grid; place-items: center; font-size: 20px; }
        .sym { font-weight: 700; }
        .qty { color: var(--muted); font-size: var(--text-xs); font-family: var(--font-mono); }
        .usd { margin-left: auto; font-family: var(--font-mono); font-weight: 600; }
      `}</style>
    </>
  );
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="qa" onClick={onClick}>
      <span className="ic">{icon}</span>
      <span>{label}</span>
      <style>{`
        .qa { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--fg); font-size: var(--text-xs); font-weight: 600; }
        .qa:hover { border-color: var(--accent); background: var(--surface-2); }
        .ic { font-size: 20px; color: var(--accent); }
      `}</style>
    </button>
  );
}

function SendForm({ onBack }: { onBack: () => void }) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <form className="send" onSubmit={(e) => { e.preventDefault(); alert("Scaffold — no tx broadcast."); onBack(); }}>
      <button type="button" className="back" onClick={onBack}>← Back</button>
      <h2>Send</h2>
      <label><span>Recipient</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="@username or Solana address" /></label>
      <label><span>Amount (SOL)</span><input type="number" min="0" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <button type="submit" className="primary" disabled={!to || !amount}>Send</button>
      <style>{`
        .send { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
        .back { align-self: flex-start; padding: var(--space-2); color: var(--fg-dim); background: transparent; border: none; }
        h2 { margin: 0; font-size: var(--text-xl); }
        label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); color: var(--fg-dim); }
        label input { padding: var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--fg); }
        label input:focus { border-color: var(--accent); outline: none; }
        .primary { padding: var(--space-3); background: var(--accent); color: var(--accent-fg); font-weight: 700; border-radius: var(--radius-md); }
        .primary:hover:not(:disabled) { background: var(--accent-hover); }
        .primary:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </form>
  );
}

function SwapInline({ onBack }: { onBack: () => void }) {
  return (
    <section className="swap">
      <button className="back" onClick={onBack}>← Back</button>
      <h2>Swap</h2>
      <p>In-wallet swap powered by Jupiter. Rates fetched every 10 seconds.</p>
      <div className="row">
        <div className="from">
          <label>From</label>
          <div className="pair">
            <select><option>◎ SOL</option><option>💵 USDC</option></select>
            <input type="number" placeholder="0.00" defaultValue="1.0" />
          </div>
        </div>
        <div className="arrow" aria-hidden>↓</div>
        <div className="from">
          <label>To</label>
          <div className="pair">
            <select><option>💵 USDC</option><option>◎ SOL</option></select>
            <div className="readonly">187.50</div>
          </div>
        </div>
      </div>
      <dl className="meta">
        <dt>Rate</dt><dd>1 SOL = 187.50 USDC</dd>
        <dt>Fee</dt><dd>0.25%</dd>
      </dl>
      <button className="primary">Swap</button>
      <style>{`
        .swap { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
        .back { align-self: flex-start; padding: var(--space-2); color: var(--fg-dim); background: transparent; border: none; }
        h2 { margin: 0; font-size: var(--text-xl); }
        p { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); }
        .row { display: flex; flex-direction: column; gap: var(--space-3); align-items: center; }
        .from { width: 100%; padding: var(--space-4); background: var(--surface-2); border-radius: var(--radius-md); }
        .from label { display: block; color: var(--muted); font-size: var(--text-xs); margin-bottom: var(--space-2); }
        .pair { display: flex; gap: var(--space-3); align-items: center; }
        .pair select { background: transparent; color: var(--fg); font-weight: 600; font-size: var(--text-base); border: none; }
        .pair input, .readonly { flex: 1; text-align: right; background: transparent; border: none; color: var(--fg); font-family: var(--font-mono); font-size: var(--text-xl); }
        .arrow { width: 32px; height: 32px; border-radius: var(--radius-full); background: var(--surface); border: 1px solid var(--border); display: grid; place-items: center; color: var(--accent); }
        .meta { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: var(--space-1) var(--space-4); font-size: var(--text-sm); }
        .meta dt { color: var(--muted); } .meta dd { margin: 0; text-align: right; font-family: var(--font-mono); }
        .primary { padding: var(--space-3); background: var(--accent); color: var(--accent-fg); font-weight: 700; border-radius: var(--radius-md); }
      `}</style>
    </section>
  );
}
