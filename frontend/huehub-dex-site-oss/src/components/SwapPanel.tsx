import { useMemo, useState } from "react";

import { TOKENS, formatTokens, quote, type TokenInfo } from "../lib/swap";

export function SwapPanel() {
  const [from, setFrom] = useState<TokenInfo>(TOKENS[0]);
  const [to, setTo] = useState<TokenInfo>(TOKENS[1]);
  const [amount, setAmount] = useState("1.0");
  const [slippageBps, setSlippageBps] = useState(50);

  const q = useMemo(() => {
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      const inAmount = BigInt(Math.floor(n * 10 ** from.decimals));
      return quote(from, to, inAmount, slippageBps);
    } catch { return null; }
  }, [from, to, amount, slippageBps]);

  const flip = () => { const x = from; setFrom(to); setTo(x); };

  return (
    <section className="swap">
      <div className="row">
        <Side label="You pay" token={from} onChange={setFrom} />
        <input
          className="amount"
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <button className="flip" onClick={flip} aria-label="Swap direction">↕</button>

      <div className="row dim">
        <Side label="You receive" token={to} onChange={setTo} excludeMint={from.mint} />
        <div className="amount ro">
          {q ? formatTokens(q.outAmount, to.decimals, 6) : "—"}
        </div>
      </div>

      <dl className="stats">
        <dt>Rate</dt>
        <dd>1 {from.symbol} ≈ {q ? formatTokens(q.outAmount * BigInt(10 ** from.decimals) / (q.inAmount || 1n), to.decimals, 6) : "—"} {to.symbol}</dd>
        <dt>Route</dt>
        <dd>{q?.route.join(" → ") ?? "—"}</dd>
        <dt>Price impact</dt>
        <dd className={q && q.priceImpactPct > 1 ? "warn" : ""}>
          {q ? q.priceImpactPct.toFixed(2) : "0.00"}%
        </dd>
        <dt>Slippage</dt>
        <dd>
          <select value={slippageBps} onChange={(e) => setSlippageBps(Number.parseInt(e.target.value))}>
            <option value={10}>0.1%</option>
            <option value={50}>0.5%</option>
            <option value={100}>1.0%</option>
            <option value={500}>5.0%</option>
          </select>
        </dd>
      </dl>

      <button className="submit" disabled={!q}>{q ? `Swap ${from.symbol} → ${to.symbol}` : "Enter amount"}</button>

      <p className="foot">
        Powered by Jupiter v6. Routes fetched at quote time; final
        execution price may differ within slippage tolerance.
      </p>

      <style>{`
        .swap {
          padding: var(--space-6);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .row {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-4);
          background: var(--surface-2); border-radius: var(--radius-md);
        }
        .amount {
          flex: 1; text-align: right;
          background: transparent; border: none; font-size: var(--text-2xl);
          font-family: var(--font-mono); color: var(--fg); min-width: 0;
        }
        .amount.ro { cursor: default; }
        .flip {
          align-self: center;
          width: 36px; height: 36px; border-radius: var(--radius-full);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--fg-dim); font-size: 20px;
          margin: calc(-1 * var(--space-2)) 0;
          transition: transform 0.15s ease, color 0.15s ease;
        }
        .flip:hover { color: var(--accent); transform: rotate(180deg); }
        .stats {
          margin: var(--space-2) 0 0;
          display: grid; grid-template-columns: 1fr auto; gap: var(--space-1) var(--space-4);
          font-size: var(--text-sm);
        }
        .stats dt { color: var(--muted); }
        .stats dd { margin: 0; text-align: right; font-family: var(--font-mono); }
        .stats select { background: transparent; color: var(--fg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px 8px; }
        .warn { color: var(--warn); }
        .submit {
          margin-top: var(--space-4); padding: var(--space-4);
          background: var(--accent); color: var(--accent-fg);
          font-weight: 700; font-size: var(--text-base);
          border-radius: var(--radius-md);
        }
        .submit:hover:not(:disabled) { background: var(--accent-hover); }
        .submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .foot { margin: 0; color: var(--muted); font-size: var(--text-xs); text-align: center; }
      `}</style>
    </section>
  );
}

function Side({
  label, token, onChange, excludeMint,
}: {
  label: string;
  token: TokenInfo;
  onChange: (t: TokenInfo) => void;
  excludeMint?: string;
}) {
  return (
    <div className="side">
      <small>{label}</small>
      <select
        value={token.mint}
        onChange={(e) => {
          const next = TOKENS.find((t) => t.mint === e.target.value);
          if (next) onChange(next);
        }}
      >
        {TOKENS.filter((t) => t.mint !== excludeMint).map((t) => (
          <option key={t.mint} value={t.mint}>{t.logo} {t.symbol}</option>
        ))}
      </select>
      <style>{`
        .side { display: flex; flex-direction: column; gap: var(--space-1); min-width: 120px; }
        .side small { color: var(--muted); font-size: var(--text-xs); }
        .side select {
          background: transparent; color: var(--fg);
          border: none; font-size: var(--text-lg); font-weight: 600;
          padding: 4px 0; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
