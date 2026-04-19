import { useState } from "react";
import { StrategyDetail, type PositionDetail } from "./StrategyDetail";

const INITIAL: PositionDetail[] = [
  {
    id: "G-1024", strategy: "Grid", pair: "SOL/USDC",
    openedAt: Date.now() - 86400e3 * 3,
    pnlPct: 2.14, pnlUsd: 42.80, value: 2042.80, status: "running",
    config: { min: "150", max: "220", gridCount: "10", totalUsd: "2000" },
    trades: [
      { at: Date.now() - 3600e3 * 6, kind: "buy",  price: 186.5, size: 0.5 },
      { at: Date.now() - 3600e3 * 4, kind: "sell", price: 189.2, size: 0.5 },
      { at: Date.now() - 3600e3 * 2, kind: "buy",  price: 185.0, size: 0.5 },
    ],
  },
  {
    id: "D-0512", strategy: "DCA", pair: "BTC/USDC",
    openedAt: Date.now() - 86400e3 * 14,
    pnlPct: 5.67, pnlUsd: 567.00, value: 10567.00, status: "running",
    config: { amountUsd: "500", interval: "1d" },
    trades: Array.from({ length: 14 }, (_, i) => ({
      at: Date.now() - 86400e3 * (14 - i), kind: "buy" as const,
      price: 62000 + i * 300, size: 500,
    })),
  },
  {
    id: "S-2048", strategy: "Sniper", pair: "Various",
    openedAt: Date.now() - 3600e3 * 2,
    pnlPct: -3.21, pnlUsd: -32.10, value: 967.90, status: "running",
    config: { maxPriceSol: "0.001", buySize: "0.1", rugGuardBps: "500" },
    trades: [{ at: Date.now() - 3600e3, kind: "buy", price: 0.0008, size: 125 }],
  },
  {
    id: "C-0256", strategy: "Copy", pair: "Mirror: @whale_1",
    openedAt: Date.now() - 86400e3 * 1,
    pnlPct: 0.42, pnlUsd: 4.20, value: 1004.20, status: "paused",
    config: { target: "Whale1Abc…zYz", sizeMultiplier: "0.1" },
    trades: [],
  },
  {
    id: "L-0004", strategy: "Limit", pair: "JUP/USDC",
    openedAt: Date.now() - 3600e3 * 8,
    pnlPct: 0, pnlUsd: 0, value: 500, status: "running",
    config: { pair: "JUP/USDC", side: "buy", price: "1.10", size: "500" },
    trades: [],
  },
  {
    id: "G-0992", strategy: "Grid", pair: "BONK/USDC",
    openedAt: Date.now() - 86400e3 * 21,
    pnlPct: 12.3, pnlUsd: 123.00, value: 1123.00, status: "closed",
    config: { min: "0.00002", max: "0.00003", gridCount: "20" },
    trades: Array.from({ length: 18 }, (_, i) => ({
      at: Date.now() - 86400e3 * (21 - i),
      kind: i % 2 === 0 ? "buy" as const : "sell" as const,
      price: 0.000025 + (i % 3) * 0.000001, size: 5_000_000,
    })),
  },
];

type Filter = "active" | "history" | "all";

export function PositionsTable() {
  const [positions, setPositions] = useState<PositionDetail[]>(INITIAL);
  const [open, setOpen] = useState<PositionDetail | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  const list = positions.filter((p) =>
    filter === "all" ? true :
    filter === "active" ? p.status !== "closed" :
    p.status === "closed"
  );
  const total = list.reduce((s, p) => s + p.value, 0);
  const totalPnl = list.reduce((s, p) => s + p.pnlUsd, 0);

  return (
    <div>
      <header className="head">
        <div><small>Total value</small><h1>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1></div>
        <div><small>Unrealized P/L</small>
          <h1 className={totalPnl >= 0 ? "gain" : "loss"}>{totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}</h1>
        </div>
        <div><small>Active</small><h1>{positions.filter((p) => p.status === "running").length}</h1></div>
        <div className="tabs">
          <button data-on={filter === "active"} onClick={() => setFilter("active")}>Active</button>
          <button data-on={filter === "history"} onClick={() => setFilter("history")}>History</button>
          <button data-on={filter === "all"} onClick={() => setFilter("all")}>All</button>
        </div>
      </header>

      <table className="positions">
        <thead>
          <tr>
            <th>ID</th><th>Strategy</th><th>Pair</th><th>Age</th><th>Value</th><th>P/L</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => {
            const ageH = Math.round((Date.now() - p.openedAt) / 3600e3);
            const age = ageH >= 24 ? `${Math.floor(ageH / 24)}d` : `${ageH}h`;
            return (
              <tr key={p.id} onClick={() => setOpen(p)}>
                <td className="mono dim">{p.id}</td>
                <td><strong>{p.strategy}</strong></td>
                <td className="mono">{p.pair}</td>
                <td className="dim">{age}</td>
                <td className="mono">${p.value.toFixed(2)}</td>
                <td className={`mono ${p.pnlUsd > 0 ? "gain" : p.pnlUsd < 0 ? "loss" : ""}`}>
                  {p.pnlUsd > 0 ? "+" : ""}${p.pnlUsd.toFixed(2)} <small>({p.pnlPct.toFixed(2)}%)</small>
                </td>
                <td><span className={`pill ${p.status}`}>{p.status}</span></td>
                <td><button className="row-btn" onClick={(e) => { e.stopPropagation(); setOpen(p); }}>Detail</button></td>
              </tr>
            );
          })}
          {list.length === 0 && (
            <tr><td colSpan={8} className="empty">No positions in this view.</td></tr>
          )}
        </tbody>
      </table>

      {open && (
        <StrategyDetail
          pos={open}
          onClose={() => setOpen(null)}
          onUpdate={(next) => {
            setPositions((prev) => prev.map((x) => x.id === next.id ? next : x));
            setOpen(next);
          }}
        />
      )}

      <style>{`
        .head {
          display: grid; grid-template-columns: repeat(3, auto) 1fr; gap: var(--space-6);
          padding: var(--space-5) var(--space-6); margin-bottom: var(--space-6);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); align-items: center;
        }
        .head > div:not(.tabs) { display: flex; flex-direction: column; gap: var(--space-1); }
        .head small { color: var(--muted); font-size: var(--text-xs); }
        .head h1 { margin: 0; font-size: var(--text-2xl); font-family: var(--font-mono); }
        .gain { color: var(--gain); } .loss { color: var(--loss); }
        .tabs { display: flex; justify-self: end; gap: var(--space-1); padding: 4px; background: var(--surface-2); border-radius: var(--radius-full); }
        .tabs button { padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); color: var(--fg-dim); font-weight: 600; font-size: var(--text-sm); }
        .tabs button[data-on="true"] { background: var(--accent-ghost); color: var(--accent); }

        .positions { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .positions th, .positions td { padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--text-sm); }
        .positions th { color: var(--muted); font-weight: 500; text-transform: uppercase; font-size: var(--text-xs); letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
        .positions tbody tr { border-bottom: 1px solid var(--border); cursor: pointer; }
        .positions tbody tr:last-child { border-bottom: none; }
        .positions tbody tr:hover { background: var(--surface-2); }
        .mono { font-family: var(--font-mono); }
        .dim { color: var(--muted); }
        .pill { padding: 2px 10px; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .pill.running { background: color-mix(in srgb, var(--gain) 15%, transparent); color: var(--gain); }
        .pill.paused { background: color-mix(in srgb, var(--warn) 15%, transparent); color: var(--warn); }
        .pill.closed { background: color-mix(in srgb, var(--muted) 15%, transparent); color: var(--muted); }
        .row-btn { padding: var(--space-1) var(--space-3); color: var(--muted); border-radius: var(--radius-sm); font-size: var(--text-xs); }
        .row-btn:hover { background: var(--border); color: var(--fg); }
        .empty { text-align: center; padding: var(--space-8); color: var(--muted); }

        @media (max-width: 820px) {
          .head { grid-template-columns: 1fr 1fr; }
          .tabs { grid-column: 1 / -1; justify-self: start; }
        }
      `}</style>
    </div>
  );
}
