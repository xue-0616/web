/**
 * Position detail panel — shown when a row in PositionsTable is clicked.
 * Three tabs: P/L chart / trades / configuration. Controls pause / edit
 * params / close. Real wiring issues a PATCH against the executor API;
 * here we mutate local state via onUpdate.
 */
import { useState } from "react";

export interface PositionDetail {
  id: string;
  strategy: string;
  pair: string;
  openedAt: number;
  pnlPct: number;
  pnlUsd: number;
  value: number;
  status: "running" | "paused" | "closed";
  config: Record<string, string>;
  trades: Array<{ at: number; kind: "buy" | "sell"; price: number; size: number }>;
}

export function StrategyDetail({ pos, onClose, onUpdate }: {
  pos: PositionDetail;
  onClose: () => void;
  onUpdate: (p: PositionDetail) => void;
}) {
  const [tab, setTab] = useState<"chart" | "trades" | "config">("chart");

  const toggleStatus = () =>
    onUpdate({ ...pos, status: pos.status === "running" ? "paused" : "running" });
  const close = () => { onUpdate({ ...pos, status: "closed" }); onClose(); };

  // Deterministic value-over-time line derived from openedAt → now.
  const ageH = Math.max(1, Math.floor((Date.now() - pos.openedAt) / 3600e3));
  const N = Math.min(48, ageH);
  const line = Array.from({ length: N }, (_, i) => {
    const noise = Math.sin(i * 0.5 + pos.id.charCodeAt(0)) * 0.04;
    return pos.value * (1 - pos.pnlPct / 100) + (pos.pnlUsd / N) * i + noise * pos.value;
  });
  const min = Math.min(...line), max = Math.max(...line);
  const points = line.map((v, i) =>
    `${(i / (line.length - 1 || 1)) * 320},${120 - ((v - min) / (max - min || 1)) * 100}`
  ).join(" ");

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <div className="id">{pos.id}</div>
            <h3>{pos.strategy} · {pos.pair}</h3>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="summary">
          <div><small>Value</small><strong>${pos.value.toFixed(2)}</strong></div>
          <div><small>P/L</small>
            <strong className={pos.pnlUsd >= 0 ? "gain" : "loss"}>
              {pos.pnlUsd >= 0 ? "+" : ""}${pos.pnlUsd.toFixed(2)} ({pos.pnlPct.toFixed(2)}%)
            </strong>
          </div>
          <div><small>Status</small>
            <strong className={`pill ${pos.status}`}>{pos.status}</strong>
          </div>
        </div>

        <nav className="tabs">
          <button data-on={tab === "chart"} onClick={() => setTab("chart")}>P/L chart</button>
          <button data-on={tab === "trades"} onClick={() => setTab("trades")}>Trades ({pos.trades.length})</button>
          <button data-on={tab === "config"} onClick={() => setTab("config")}>Configuration</button>
        </nav>

        {tab === "chart" && (
          <svg viewBox="0 0 320 120" role="img" aria-label="Value over time">
            <polyline fill="none" stroke={pos.pnlUsd >= 0 ? "var(--gain)" : "var(--loss)"} strokeWidth="2" points={points} />
          </svg>
        )}

        {tab === "trades" && (
          <ul className="trades">
            {pos.trades.length === 0 ? (
              <li className="empty">No trades yet.</li>
            ) : pos.trades.map((t, i) => (
              <li key={i}>
                <span className={`side ${t.kind}`}>{t.kind.toUpperCase()}</span>
                <span className="size">{t.size}</span>
                <span className="price">@ ${t.price.toFixed(4)}</span>
                <span className="time">{new Date(t.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "config" && (
          <dl className="config">
            {Object.entries(pos.config).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}

        <footer>
          <button className="ghost" onClick={toggleStatus}>
            {pos.status === "running" ? "⏸ Pause" : "▶ Resume"}
          </button>
          <button className="ghost">Edit params</button>
          <button className="danger" onClick={close}>Close position</button>
        </footer>
      </div>
      <style>{`
        .scrim { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: grid; place-items: center; padding: var(--space-4); }
        .modal { width: 100%; max-width: 640px; max-height: 90vh; overflow: auto; background: var(--surface); border: 1px solid var(--border-bright); border-radius: var(--radius-lg); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }
        header { display: flex; align-items: flex-start; }
        .id { color: var(--muted); font-family: var(--font-mono); font-size: var(--text-xs); }
        header h3 { margin: 0; font-size: var(--text-xl); }
        .close { margin-left: auto; width: 32px; height: 32px; border-radius: var(--radius-full); color: var(--muted); font-size: 22px; }
        .close:hover { background: var(--surface-2); color: var(--fg); }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); padding: var(--space-4); background: var(--surface-2); border-radius: var(--radius-md); }
        .summary small { display: block; color: var(--muted); font-size: var(--text-xs); margin-bottom: 4px; }
        .summary strong { font-size: var(--text-lg); font-family: var(--font-mono); }
        .gain { color: var(--gain); } .loss { color: var(--loss); }
        .pill { padding: 2px 10px; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .pill.running { background: color-mix(in srgb, var(--gain) 15%, transparent); color: var(--gain); }
        .pill.paused { background: color-mix(in srgb, var(--warn) 15%, transparent); color: var(--warn); }
        .pill.closed { background: color-mix(in srgb, var(--muted) 20%, transparent); color: var(--muted); }
        .tabs { display: flex; gap: var(--space-1); border-bottom: 1px solid var(--border); }
        .tabs button { padding: var(--space-2) var(--space-4); color: var(--fg-dim); font-weight: 600; font-size: var(--text-sm); border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .tabs button[data-on="true"] { color: var(--accent); border-bottom-color: var(--accent); }
        svg { width: 100%; height: 160px; background: var(--surface-2); border-radius: var(--radius-md); padding: var(--space-3); }
        .trades { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
        .trades li { display: grid; grid-template-columns: 60px 1fr 120px 80px; gap: var(--space-3); padding: var(--space-2) var(--space-3); background: var(--surface-2); border-radius: var(--radius-sm); font-size: var(--text-sm); }
        .trades .empty { grid-template-columns: 1fr; text-align: center; color: var(--muted); }
        .side { font-weight: 700; font-size: var(--text-xs); }
        .side.buy { color: var(--gain); } .side.sell { color: var(--loss); }
        .size, .price { font-family: var(--font-mono); }
        .time { color: var(--muted); font-size: var(--text-xs); text-align: right; }
        .config { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: var(--space-2) var(--space-4); }
        .config div { display: contents; }
        .config dt { color: var(--muted); font-size: var(--text-sm); }
        .config dd { margin: 0; font-family: var(--font-mono); font-size: var(--text-sm); }
        footer { display: flex; gap: var(--space-3); }
        footer button { flex: 1; padding: var(--space-3); border-radius: var(--radius-md); font-weight: 600; font-size: var(--text-sm); }
        .ghost { background: var(--surface-2); color: var(--fg); }
        .ghost:hover { background: var(--border); }
        .danger { background: color-mix(in srgb, var(--loss) 15%, var(--surface-2)); color: var(--loss); border: 1px solid color-mix(in srgb, var(--loss) 40%, var(--border)); }
        .danger:hover { background: color-mix(in srgb, var(--loss) 25%, var(--surface-2)); }
      `}</style>
    </div>
  );
}
