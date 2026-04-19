import { useState } from "react";
import { TOKENS, formatTokens, type TokenInfo } from "../lib/swap";
import { EmptyState } from "./states";

interface LimitOrder {
  id: string;
  from: TokenInfo;
  to: TokenInfo;
  price: number;
  amountIn: string;
  side: "buy" | "sell";
  placedAt: number;
  status: "open" | "filled" | "cancelled";
}

const SEED: LimitOrder[] = [
  { id: "L-0001", from: TOKENS[0], to: TOKENS[1], price: 200, amountIn: "1.0", side: "sell", placedAt: Date.now() - 2 * 3600e3, status: "open" },
  { id: "L-0002", from: TOKENS[1], to: TOKENS[0], price: 150, amountIn: "300", side: "buy", placedAt: Date.now() - 9 * 3600e3, status: "open" },
  { id: "L-0003", from: TOKENS[0], to: TOKENS[3], price: 0.008, amountIn: "0.5", side: "sell", placedAt: Date.now() - 24 * 3600e3, status: "filled" },
];

/**
 * Limit-order creation + active-list page. Orders are stored in
 * component state (scaffold); production wires into Jupiter's
 * `/limit-order` API which uses PDA-backed on-chain orders.
 */
export function LimitPage() {
  const [orders, setOrders] = useState<LimitOrder[]>(SEED);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [from, setFrom] = useState<TokenInfo>(TOKENS[0]);
  const [to, setTo] = useState<TokenInfo>(TOKENS[1]);
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number.parseFloat(price);
    if (!Number.isFinite(p) || p <= 0 || !amount) return;
    setOrders((o) => [{
      id: `L-${(o.length + 1).toString().padStart(4, "0")}`,
      from, to, price: p, amountIn: amount, side,
      placedAt: Date.now(), status: "open",
    }, ...o]);
    setPrice(""); setAmount("");
  };

  const cancel = (id: string) => {
    setOrders((o) => o.map((x) => x.id === id ? { ...x, status: "cancelled" as const } : x));
  };

  const marketPrice = from.priceUsd / to.priceUsd;

  return (
    <div className="wrap">
      <div className="grid">
        <form onSubmit={submit}>
          <h2>Place limit order</h2>
          <div className="side">
            <button type="button" data-on={side === "buy"} onClick={() => setSide("buy")}>Buy</button>
            <button type="button" data-on={side === "sell"} onClick={() => setSide("sell")}>Sell</button>
          </div>
          <div className="pair">
            <label>
              <span>Pay with</span>
              <select value={from.mint} onChange={(e) => {
                const n = TOKENS.find((t) => t.mint === e.target.value);
                if (n) setFrom(n);
              }}>
                {TOKENS.map((t) => <option key={t.mint} value={t.mint}>{t.logo} {t.symbol}</option>)}
              </select>
            </label>
            <label>
              <span>Receive</span>
              <select value={to.mint} onChange={(e) => {
                const n = TOKENS.find((t) => t.mint === e.target.value);
                if (n) setTo(n);
              }}>
                {TOKENS.filter((t) => t.mint !== from.mint).map((t) => <option key={t.mint} value={t.mint}>{t.logo} {t.symbol}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Limit price (1 {from.symbol} = X {to.symbol})</span>
            <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={marketPrice.toPrecision(6)} />
            <small>Market: {marketPrice.toPrecision(6)} {to.symbol}</small>
          </label>
          <label>
            <span>Amount ({from.symbol})</span>
            <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <button type="submit" className="submit">Place order</button>
        </form>

        <section>
          <h2>Active orders</h2>
          {orders.filter((o) => o.status === "open").length === 0 ? (
            <EmptyState icon="📋" title="No active orders" hint="Placed orders appear here until filled or cancelled." />
          ) : (
            <ul>
              {orders.filter((o) => o.status === "open").map((o) => (
                <li key={o.id}>
                  <div className="tag">{o.side}</div>
                  <div className="detail">
                    <div className="pairline">{o.amountIn} {o.from.symbol} → {o.to.symbol}</div>
                    <div className="meta">@ {o.price} · {new Date(o.placedAt).toLocaleTimeString()}</div>
                  </div>
                  <button className="cancel" onClick={() => cancel(o.id)}>Cancel</button>
                </li>
              ))}
            </ul>
          )}

          <h3>History</h3>
          <ul className="hist">
            {orders.filter((o) => o.status !== "open").map((o) => (
              <li key={o.id}>
                <span className={`tag ${o.status}`}>{o.status}</span>
                <div className="detail">
                  <div className="pairline">{o.amountIn} {o.from.symbol} → {o.to.symbol}</div>
                  <div className="meta">@ {o.price}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <style>{`
        .wrap { }
        .grid { display: grid; grid-template-columns: 380px 1fr; gap: var(--space-6); align-items: start; }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }

        form, section {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-4);
        }
        h2 { margin: 0; font-size: var(--text-xl); }
        h3 { margin: var(--space-4) 0 var(--space-2); font-size: var(--text-sm); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .side { display: flex; gap: var(--space-1); background: var(--surface-2); padding: 4px; border-radius: var(--radius-md); }
        .side button { flex: 1; padding: var(--space-2); border-radius: var(--radius-sm); color: var(--fg-dim); font-weight: 600; font-size: var(--text-sm); }
        .side button[data-on="true"] { background: var(--accent); color: var(--accent-fg); }
        .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
        label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); color: var(--fg-dim); }
        label input, label select { padding: var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--fg); }
        label input:focus, label select:focus { border-color: var(--accent); outline: none; }
        label small { color: var(--muted); font-size: var(--text-xs); font-family: var(--font-mono); }
        .submit { padding: var(--space-3); background: var(--accent); color: var(--accent-fg); border-radius: var(--radius-md); font-weight: 700; }
        .submit:hover { background: var(--accent-hover); }

        section ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
        section li { display: flex; gap: var(--space-3); align-items: center; padding: var(--space-3); background: var(--surface-2); border-radius: var(--radius-md); }
        .tag { padding: 2px 10px; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: var(--border); color: var(--fg); }
        .tag.filled { background: color-mix(in srgb, var(--gain) 15%, transparent); color: var(--gain); }
        .tag.cancelled { background: color-mix(in srgb, var(--muted) 20%, transparent); color: var(--muted); }
        .detail { flex: 1; }
        .pairline { font-size: var(--text-sm); font-weight: 600; }
        .meta { color: var(--muted); font-size: var(--text-xs); font-family: var(--font-mono); }
        .cancel { padding: var(--space-1) var(--space-3); background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--fg-dim); font-size: var(--text-xs); }
        .cancel:hover { border-color: var(--loss); color: var(--loss); }
        .hist { opacity: 0.7; }
      `}</style>
    </div>
  );
}
