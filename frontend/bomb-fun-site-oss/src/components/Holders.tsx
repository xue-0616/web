import { shortAddr } from "../lib/wallet";

/**
 * Top 20 holders for a given mint. Real deploy scans
 * `getProgramAccounts` for the bonding-curve program and the standard
 * SPL-Token program. The holder percentage is computed against the
 * circulating supply (initialSupply - realToken in reserve).
 */
export function Holders({ mint }: { mint: string }) {
  const rows = generateMockHolders(mint);
  return (
    <div className="holders">
      <header>
        <h4>Top holders</h4>
        <small>{rows.length} shown · refreshes every 30s</small>
      </header>
      <ol>
        {rows.map((h, i) => (
          <li key={h.address}>
            <span className="rank">#{i + 1}</span>
            <span className="addr">{shortAddr(h.address, 5)}</span>
            <span className="bar" style={{ width: `${h.pct * 100}%` }} />
            <span className="pct">{(h.pct * 100).toFixed(2)}%</span>
          </li>
        ))}
      </ol>
      <style>{`
        .holders {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-5);
        }
        header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-4); }
        h4 { margin: 0; font-size: var(--text-base); }
        header small { color: var(--muted); font-size: var(--text-xs); }
        ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
        li {
          display: grid; grid-template-columns: 32px 1fr 60px;
          gap: var(--space-3); align-items: center;
          padding: var(--space-2);
          position: relative; overflow: hidden;
          border-radius: var(--radius-sm);
          font-size: var(--text-sm);
        }
        li:hover { background: var(--surface-2); }
        .rank { color: var(--muted); font-family: var(--font-mono); font-size: var(--text-xs); }
        .addr { font-family: var(--font-mono); color: var(--fg-dim); z-index: 1; }
        .bar {
          position: absolute; left: 40px; right: 70px; top: 50%;
          height: 3px; transform: translateY(-50%);
          background: color-mix(in srgb, var(--accent) 30%, transparent);
          border-radius: var(--radius-full); z-index: 0;
        }
        .pct { text-align: right; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--fg); z-index: 1; }
      `}</style>
    </div>
  );
}

/**
 * Deterministically hash the mint to get stable-looking addresses and
 * percentages. Power-law distribution for realism (top holder ~18%,
 * tail drops off sharply).
 */
function generateMockHolders(mint: string) {
  const seed = [...mint].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = mulberry32(seed);
  const raw = Array.from({ length: 20 }, (_, i) => {
    // Power law: w_i = 1/(i+1)^1.2 with noise
    const base = 1 / Math.pow(i + 1, 1.2);
    return base * (0.8 + rng() * 0.4);
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w, i) => ({
    address: pseudoAddr(rng),
    pct: (w / sum) * 0.85,  // top 20 hold ~85% of circulating
    _i: i,
  }));
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pseudoAddr(rng: () => number): string {
  const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 44; i++) s += ALPHA[Math.floor(rng() * ALPHA.length)];
  return s;
}
