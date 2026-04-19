import { useMemo, useState } from "react";

/**
 * History tab — mock trade log surfaced by the strategy executor.
 *
 * Real data source (once wired):
 *   GET /v1/history?strategyId=…&limit=…
 * backed by the Rust `automatic-strategy-executor` postgres event log.
 *
 * Columns: time, strategy, pair, side, size, price, P&L, tx.
 * Filter: strategy kind + side + search by pair.
 */

type Side = "buy" | "sell";
type StrategyKind = "grid" | "dca" | "sniper" | "copy" | "limit";

interface Fill {
  ts: number;
  strategy: StrategyKind;
  pair: string;
  side: Side;
  size: number;
  price: number;
  pnlUsd: number;
  tx: string;
}

const PAIRS = ["SOL/USDC", "JUP/USDC", "BONK/SOL", "PYTH/USDC", "WIF/SOL"];
const KINDS: StrategyKind[] = ["grid", "dca", "sniper", "copy", "limit"];

function seed(i: number): Fill {
  const rnd = (n: number) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2);
  const kind = KINDS[Math.floor(rnd(1) * KINDS.length)];
  const pair = PAIRS[Math.floor(rnd(2) * PAIRS.length)];
  const side: Side = rnd(3) > 0.5 ? "buy" : "sell";
  const size = Number((0.1 + rnd(4) * 10).toFixed(3));
  const price = Number((0.01 + rnd(5) * 250).toFixed(4));
  const pnl = Number(((rnd(6) - 0.45) * 120).toFixed(2));
  const now = Date.now();
  const ts = now - i * 1000 * 60 * (5 + Math.floor(rnd(7) * 120));
  const tx = Array.from({ length: 8 }, (_, k) => "0123456789abcdef"[Math.floor(rnd(8 + k) * 16)]).join("");
  return { ts, strategy: kind, pair, side, size, price, pnlUsd: pnl, tx };
}

const MOCK_HISTORY: Fill[] = Array.from({ length: 48 }, (_, i) => seed(i + 1));

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function History() {
  const [kind, setKind] = useState<"all" | StrategyKind>("all");
  const [side, setSide] = useState<"all" | Side>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return MOCK_HISTORY.filter((f) => {
      if (kind !== "all" && f.strategy !== kind) return false;
      if (side !== "all" && f.side !== side) return false;
      if (q && !f.pair.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [kind, side, q]);

  const totalPnl = rows.reduce((s, f) => s + f.pnlUsd, 0);

  return (
    <div className="hist">
      <div className="bar">
        <div className="stats">
          <span>Fills: <strong>{rows.length}</strong></span>
          <span>Net P&L: <strong className={totalPnl >= 0 ? "up" : "down"}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </strong></span>
        </div>
        <div className="filters">
          <input placeholder="Filter pair…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">All strategies</option>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
            <option value="all">Both sides</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">No fills match the current filters.</div>
      ) : (
        <div className="table" role="table">
          <div className="row head" role="row">
            <span>Time</span><span>Strategy</span><span>Pair</span>
            <span>Side</span><span>Size</span><span>Price</span>
            <span>P&L</span><span>Tx</span>
          </div>
          {rows.map((f) => (
            <div className="row" role="row" key={f.tx + f.ts}>
              <span className="mono">{fmtTime(f.ts)}</span>
              <span className="kind" data-k={f.strategy}>{f.strategy}</span>
              <span>{f.pair}</span>
              <span className={f.side === "buy" ? "buy" : "sell"}>{f.side}</span>
              <span className="mono">{f.size}</span>
              <span className="mono">${f.price.toFixed(4)}</span>
              <span className={`mono ${f.pnlUsd >= 0 ? "up" : "down"}`}>
                {f.pnlUsd >= 0 ? "+" : ""}${f.pnlUsd.toFixed(2)}
              </span>
              <a className="mono tx" href={`https://solscan.io/tx/${f.tx}`} target="_blank" rel="noreferrer">
                {f.tx.slice(0, 4)}…
              </a>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .hist { display: flex; flex-direction: column; gap: var(--space-4); }
        .bar {
          display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;
          padding: var(--space-4); background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--radius-lg);
        }
        .stats { display: flex; gap: var(--space-6); font-size: var(--text-sm); color: var(--muted); }
        .stats strong { color: var(--fg); font-family: var(--font-mono); }
        .filters { margin-left: auto; display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .filters input, .filters select {
          padding: var(--space-2) var(--space-3);
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--radius-md); color: var(--fg); font-size: var(--text-sm);
        }
        .filters input:focus, .filters select:focus { border-color: var(--accent); outline: none; }

        .table {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
        }
        .row {
          display: grid;
          grid-template-columns: 1.2fr 0.9fr 1fr 0.6fr 0.8fr 0.9fr 0.9fr 0.7fr;
          padding: var(--space-3) var(--space-4); gap: var(--space-2);
          font-size: var(--text-sm); border-bottom: 1px solid var(--border);
          align-items: center;
        }
        .row:last-child { border-bottom: none; }
        .row.head { background: var(--surface-2); color: var(--muted); font-weight: 600; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; }
        .mono { font-family: var(--font-mono); }
        .up { color: var(--gain); } .down { color: var(--loss); }
        .buy { color: var(--gain); text-transform: uppercase; font-size: var(--text-xs); font-weight: 700; }
        .sell { color: var(--loss); text-transform: uppercase; font-size: var(--text-xs); font-weight: 700; }
        .kind {
          display: inline-block; padding: 2px var(--space-2);
          border-radius: var(--radius-full); background: var(--accent-ghost); color: var(--accent);
          font-size: var(--text-xs); font-weight: 600; text-transform: lowercase; width: fit-content;
        }
        .tx { color: var(--accent); text-decoration: none; }
        .tx:hover { text-decoration: underline; }
        .empty {
          padding: var(--space-12); text-align: center; color: var(--muted);
          background: var(--surface); border: 1px dashed var(--border);
          border-radius: var(--radius-lg);
        }
        @media (max-width: 820px) {
          .row { grid-template-columns: 1fr 1fr; row-gap: var(--space-1); }
          .row.head { display: none; }
          .row > span::before, .row > a::before {
            content: attr(data-label); display: block; color: var(--muted);
            font-size: var(--text-xs);
          }
        }
      `}</style>
    </div>
  );
}
