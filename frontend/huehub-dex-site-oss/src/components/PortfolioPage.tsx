import { EmptyState } from "./states";
import { TOKENS } from "../lib/swap";
import type { ConnectedWallet } from "../lib/wallet";

/**
 * Portfolio summary. With no wallet connected → connect CTA. With a
 * connected wallet → mock holdings derived deterministically from the
 * address so the preview is stable.
 */
export function PortfolioPage({ wallet, onConnect }: { wallet: ConnectedWallet | null; onConnect: () => void }) {
  if (!wallet) {
    return (
      <EmptyState
        icon="💼"
        title="Connect a wallet"
        hint="We'll surface your tokens, historical P/L, and recent swaps here."
        action={<button onClick={onConnect} className="cta">Connect<style>{`.cta{padding:var(--space-2) var(--space-5);border-radius:var(--radius-full);background:var(--accent);color:var(--accent-fg);font-weight:700;}.cta:hover{background:var(--accent-hover);}`}</style></button>}
      />
    );
  }

  // Deterministic holdings: hash the address to pick token counts.
  const seed = [...wallet.address].reduce((a, c) => a + c.charCodeAt(0), 0);
  const holdings = TOKENS.map((t, i) => {
    const pseudoQty = ((seed * (i + 7)) % 1000) / (i + 1);
    return { token: t, qty: pseudoQty, usd: pseudoQty * t.priceUsd };
  }).filter((h) => h.usd > 1);

  const total = holdings.reduce((s, h) => s + h.usd, 0);
  const day = total * 0.0143;  // fake 1.43% daily

  const history = Array.from({ length: 14 }, (_, i) => {
    const drift = Math.sin(i * 0.6 + seed) * 0.05 + 0.008 * i;
    return total * (1 - drift);
  });
  const min = Math.min(...history), max = Math.max(...history);
  const points = history.map((v, i) =>
    `${(i / (history.length - 1)) * 320},${120 - ((v - min) / (max - min || 1)) * 110}`
  ).join(" ");

  return (
    <div className="wrap">
      <header>
        <div>
          <small>Portfolio value</small>
          <h1>${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h1>
          <p className={day >= 0 ? "gain" : "loss"}>
            {day >= 0 ? "+" : ""}${day.toFixed(2)} ({day >= 0 ? "+" : ""}1.43%) today
          </p>
        </div>
        <svg viewBox="0 0 320 120" role="img" aria-label="14-day value chart">
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points} />
        </svg>
      </header>

      <h2>Holdings</h2>
      <ul className="holdings">
        {holdings.map(({ token, qty, usd }) => (
          <li key={token.mint}>
            <span className="logo">{token.logo}</span>
            <div className="info">
              <div className="sym">{token.symbol}</div>
              <div className="name">{token.name}</div>
            </div>
            <div className="qty">
              <div className="mono">{qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
              <div className="usd">${usd.toFixed(2)}</div>
            </div>
            <div className="share">{((usd / total) * 100).toFixed(1)}%</div>
          </li>
        ))}
      </ul>

      <h2>Recent activity</h2>
      <ul className="activity">
        <li><span className="type buy">Swap</span> 1 SOL → 187.50 USDC <em>2h ago</em></li>
        <li><span className="type buy">Buy</span> 500 USDC → 406 JUP <em>1d ago</em></li>
        <li><span className="type sell">Sell</span> 12M BONK → 0.30 SOL <em>3d ago</em></li>
        <li><span className="type buy">Swap</span> 0.5 SOL → 93.00 USDC <em>5d ago</em></li>
      </ul>

      <style>{`
        .wrap { display: flex; flex-direction: column; gap: var(--space-6); }
        header {
          display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);
          padding: var(--space-6);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        @media (max-width: 640px) { header { grid-template-columns: 1fr; } }
        header small { color: var(--muted); font-size: var(--text-sm); }
        header h1 { margin: var(--space-1) 0; font-size: var(--text-4xl); letter-spacing: -0.02em; font-family: var(--font-mono); }
        header p { margin: 0; font-size: var(--text-sm); }
        header svg { width: 100%; height: 100%; max-height: 140px; }
        h2 { margin: 0; font-size: var(--text-xl); }
        .gain { color: var(--gain); } .loss { color: var(--loss); }

        .holdings, .activity { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
        .holdings li { display: flex; gap: var(--space-4); align-items: center; padding: var(--space-3) var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
        .logo { width: 36px; height: 36px; background: var(--surface-2); border-radius: var(--radius-full); display: grid; place-items: center; font-size: 20px; }
        .info { flex: 1; }
        .sym { font-weight: 700; }
        .name { color: var(--fg-dim); font-size: var(--text-xs); }
        .qty { text-align: right; }
        .qty .mono { font-family: var(--font-mono); font-size: var(--text-sm); }
        .usd { color: var(--fg-dim); font-size: var(--text-xs); font-family: var(--font-mono); }
        .share { min-width: 56px; text-align: right; color: var(--muted); font-family: var(--font-mono); font-size: var(--text-sm); }

        .activity li { display: flex; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: var(--text-sm); }
        .activity em { margin-left: auto; color: var(--muted); font-style: normal; font-size: var(--text-xs); }
        .type { padding: 2px 10px; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .type.buy { background: color-mix(in srgb, var(--gain) 15%, transparent); color: var(--gain); }
        .type.sell { background: color-mix(in srgb, var(--loss) 15%, transparent); color: var(--loss); }
      `}</style>
    </div>
  );
}
