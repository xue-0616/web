import { lamportsToSol, progressToGraduation, spotPrice } from "../lib/curve";
import type { LaunchedToken } from "../lib/mock-tokens";

/**
 * Grid of launched tokens, ordered by "time since launch" desc so
 * the freshest shitcoins appear first (matches Pump.fun's "new"
 * tab). Each card shows enough signal to decide whether to ape:
 * progress to graduation, raised SOL, current price, mint age.
 */
export function TokenList({ tokens, onPick }: { tokens: LaunchedToken[]; onPick: (t: LaunchedToken) => void }) {
  const sorted = [...tokens].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="wrap">
      <header>
        <h2>Fresh launches</h2>
        <p>All tokens migrate to Raydium on graduation.</p>
      </header>
      <div className="grid">
        {sorted.map((t) => {
          const progress = progressToGraduation(t.curve);
          const price = spotPrice(t.curve);
          const ageMin = Math.floor((Date.now() - t.createdAt) / 60000);
          return (
            <article key={t.mint} className="card" onClick={() => onPick(t)}>
              <div className="card-top">
                <div className="emoji" aria-hidden>{t.emoji}</div>
                <div>
                  <div className="name">{t.name}</div>
                  <div className="sym">${t.symbol}</div>
                </div>
                <div className="age">{ageMin < 60 ? `${ageMin}m` : `${Math.floor(ageMin / 60)}h`}</div>
              </div>
              <p className="desc">{t.description}</p>
              <div className="stats">
                <span>
                  <label>Raised</label>
                  <strong>{lamportsToSol(t.curve.realSol, 2)} SOL</strong>
                </span>
                <span>
                  <label>Price</label>
                  <strong className="mono">{price.toExponential(2)}</strong>
                </span>
              </div>
              <div className="bar-wrap" title={`${(progress * 100).toFixed(1)}% to graduation`}>
                <div className="bar" style={{ width: `${progress * 100}%` }} />
              </div>
              <button className="ape">Ape →</button>
            </article>
          );
        })}
      </div>
      <style>{`
        .wrap { display: flex; flex-direction: column; gap: var(--space-6); }
        header h2 { margin: 0; font-size: var(--text-3xl); letter-spacing: -0.02em; }
        header p { margin: var(--space-2) 0 0; color: var(--fg-dim); }
        .grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-4);
        }
        .card {
          cursor: pointer;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-3);
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .card-top { display: flex; align-items: center; gap: var(--space-3); }
        .emoji {
          width: 48px; height: 48px;
          display: grid; place-items: center;
          background: var(--surface-2); border-radius: var(--radius-md);
          font-size: 28px;
        }
        .name { font-weight: 700; font-size: var(--text-base); }
        .sym { color: var(--accent); font-family: var(--font-mono); font-size: var(--text-xs); }
        .age { margin-left: auto; color: var(--muted); font-size: var(--text-xs); font-family: var(--font-mono); }
        .desc {
          margin: 0; color: var(--fg-dim); font-size: var(--text-sm);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .stats { display: flex; justify-content: space-between; gap: var(--space-4); }
        .stats label { display: block; font-size: var(--text-xs); color: var(--muted); }
        .stats strong { font-size: var(--text-sm); }
        .mono { font-family: var(--font-mono); }
        .bar-wrap { height: 6px; background: var(--surface-2); border-radius: var(--radius-full); overflow: hidden; }
        .bar { height: 100%; background: linear-gradient(90deg, var(--accent), #fbbf24); transition: width 0.3s ease; }
        .ape {
          padding: var(--space-2); border-radius: var(--radius-md);
          background: var(--accent-ghost); color: var(--accent); font-weight: 700;
        }
        .card:hover .ape { background: var(--accent); color: var(--accent-fg); }
      `}</style>
    </div>
  );
}
