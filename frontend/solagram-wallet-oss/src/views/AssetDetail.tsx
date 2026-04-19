/**
 * Single-asset detail — mini chart + history. Real build queries
 * `getSignaturesForAddress` on the ATA, then parses each tx's
 * inner instructions to classify (transfer / swap / stake / etc).
 */
export function AssetDetail({
  symbol, amount, usd, logo, onBack,
}: {
  symbol: string; amount: number; usd: number; logo: string;
  onBack: () => void;
}) {
  // Mock 30d price line, deterministic from symbol.
  const seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  const line = Array.from({ length: 30 }, (_, i) => {
    const noise = Math.sin(i * 0.9 + seed) * 0.08;
    const drift = 0.002 * i;
    return 1 + noise - drift + (seed % 7) * 0.01;
  });
  const min = Math.min(...line), max = Math.max(...line);
  const path = line.map((v, i) =>
    `${(i / (line.length - 1)) * 320},${120 - ((v - min) / (max - min || 1)) * 100}`
  ).join(" ");
  const change = ((line[line.length - 1] - line[0]) / line[0]) * 100;

  const activity = [
    { kind: "Received", amount: amount * 0.3, from: "@friend", at: "2h ago" },
    { kind: "Sent", amount: amount * 0.1, from: "→ 9aRx…pLs", at: "1d ago" },
    { kind: "Swapped", amount: amount * 0.15, from: "via HueHub", at: "3d ago" },
    { kind: "Received", amount: amount * 0.5, from: "@airdrop", at: "1w ago" },
  ];

  return (
    <section className="asset">
      <button className="back" onClick={onBack}>← Back</button>

      <header>
        <div className="logo" aria-hidden>{logo}</div>
        <div>
          <h2>{symbol}</h2>
          <div className="qty">{amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {symbol}</div>
          <div className="usd">
            ${usd.toFixed(2)}
            <span className={change >= 0 ? "gain" : "loss"}>
              {change >= 0 ? "+" : ""}{change.toFixed(2)}% 30d
            </span>
          </div>
        </div>
      </header>

      <svg viewBox="0 0 320 120" role="img" aria-label={`${symbol} 30-day price chart`}>
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={path} />
      </svg>

      <div className="actions">
        <button className="primary">Send</button>
        <button className="primary">Receive</button>
        <button className="ghost">Swap</button>
      </div>

      <h3>Activity</h3>
      <ul>
        {activity.map((a, i) => (
          <li key={i}>
            <div>
              <div className="kind">{a.kind}</div>
              <div className="from">{a.from}</div>
            </div>
            <div className="right">
              <div className="amt">{a.amount.toFixed(2)} {symbol}</div>
              <div className="time">{a.at}</div>
            </div>
          </li>
        ))}
      </ul>

      <style>{`
        .asset { display: flex; flex-direction: column; gap: var(--space-4); }
        .back { align-self: flex-start; padding: var(--space-2); color: var(--fg-dim); }
        header { display: flex; gap: var(--space-4); padding: var(--space-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
        .logo { width: 56px; height: 56px; border-radius: var(--radius-md); background: var(--surface-2); display: grid; place-items: center; font-size: 28px; flex-shrink: 0; }
        header h2 { margin: 0; font-size: var(--text-xl); }
        .qty { color: var(--fg-dim); font-size: var(--text-sm); font-family: var(--font-mono); }
        .usd { margin-top: var(--space-2); font-size: var(--text-2xl); font-family: var(--font-mono); font-weight: 700; display: flex; gap: var(--space-3); align-items: baseline; }
        .usd span { font-size: var(--text-sm); font-weight: 500; }
        .gain { color: var(--gain); } .loss { color: var(--loss); }
        svg { width: 100%; height: 140px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); display: block; }
        .actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
        .primary { padding: var(--space-3); background: var(--accent); color: var(--accent-fg); border-radius: var(--radius-md); font-weight: 600; }
        .primary:hover { background: var(--accent-hover); }
        .ghost { padding: var(--space-3); background: transparent; border: 1px solid var(--border-bright); color: var(--fg); border-radius: var(--radius-md); font-weight: 600; }
        .ghost:hover { background: var(--surface-2); }
        h3 { margin: var(--space-2) 0 0; font-size: var(--text-sm); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
        ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
        ul li { display: flex; gap: var(--space-4); align-items: center; padding: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
        .kind { font-weight: 600; font-size: var(--text-sm); }
        .from { color: var(--muted); font-size: var(--text-xs); }
        .right { margin-left: auto; text-align: right; }
        .amt { font-family: var(--font-mono); font-size: var(--text-sm); }
        .time { color: var(--muted); font-size: var(--text-xs); }
      `}</style>
    </section>
  );
}
