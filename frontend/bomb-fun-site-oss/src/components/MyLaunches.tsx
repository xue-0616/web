import { EmptyState } from "./states";
import { lamportsToSol, progressToGraduation, spotPrice } from "../lib/curve";
import { MOCK_TOKENS } from "../lib/mock-tokens";
import type { ConnectedWallet } from "../lib/wallet";

/**
 * "My launches + positions" tab. The concept: any token you created
 * (creator == your pubkey) or hold (ATA.amount > 0) shows here.
 *
 * With no wallet connected we render the connect-to-see CTA. With a
 * mock wallet we cheat: show 2 entries so the UI is visible in preview.
 */
export function MyLaunches({ wallet, onConnect }: { wallet: ConnectedWallet | null; onConnect: () => void }) {
  if (!wallet) {
    return (
      <EmptyState
        icon="🔗"
        title="Connect a wallet"
        hint="Your launches and positions appear here once you connect."
        action={<button className="cta" onClick={onConnect}>Connect<style>{CTA}</style></button>}
      />
    );
  }

  // Mock: two slices of the full list flagged as "mine".
  const launched = MOCK_TOKENS.slice(0, 1);
  const held = MOCK_TOKENS.slice(2, 4).map((t) => ({
    token: t,
    balanceTokens: BigInt(Math.floor(Math.random() * 1e11)),
    costBasisSol: BigInt(Math.floor(Math.random() * 500_000_000)),
  }));

  return (
    <div className="mine">
      <section>
        <header><h3>Launched by you</h3><small>{launched.length} · lifetime</small></header>
        {launched.length === 0 ? (
          <EmptyState icon="🚀" title="You haven't launched yet" hint="Head to the Launch tab to create your first token." />
        ) : (
          <ul>
            {launched.map((t) => {
              const prog = progressToGraduation(t.curve);
              return (
                <li key={t.mint}>
                  <div className="emoji">{t.emoji}</div>
                  <div className="info">
                    <div className="name">{t.name} <span>${t.symbol}</span></div>
                    <div className="dim">Raised {lamportsToSol(t.curve.realSol, 2)} SOL · {(prog * 100).toFixed(1)}% to graduation</div>
                  </div>
                  <div className="metric">
                    <label>Your cut</label>
                    <strong>{lamportsToSol(t.curve.realSol / 10n, 4)} SOL</strong>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <header><h3>Positions</h3><small>{held.length} open</small></header>
        <ul>
          {held.map(({ token, balanceTokens, costBasisSol }) => {
            const value = (Number(balanceTokens) * spotPrice(token.curve));
            const valueSol = value / 1e9;
            const cost = Number(costBasisSol) / 1e9;
            const pl = valueSol - cost;
            return (
              <li key={token.mint}>
                <div className="emoji">{token.emoji}</div>
                <div className="info">
                  <div className="name">{token.name} <span>${token.symbol}</span></div>
                  <div className="dim">
                    Holding {(Number(balanceTokens) / 1e12).toFixed(2)}M · cost {cost.toFixed(3)} SOL
                  </div>
                </div>
                <div className="metric">
                  <label>Value</label>
                  <strong className={pl >= 0 ? "gain" : "loss"}>
                    {valueSol.toFixed(3)} SOL
                  </strong>
                  <small className={pl >= 0 ? "gain" : "loss"}>{pl >= 0 ? "+" : ""}{pl.toFixed(3)}</small>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <style>{`
        .mine { display: flex; flex-direction: column; gap: var(--space-8); }
        section header { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-4); }
        h3 { margin: 0; font-size: var(--text-xl); }
        section header small { color: var(--muted); font-size: var(--text-sm); }
        ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
        li {
          display: flex; align-items: center; gap: var(--space-4);
          padding: var(--space-4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .emoji {
          width: 44px; height: 44px; flex-shrink: 0;
          background: var(--surface-2); border-radius: var(--radius-md);
          display: grid; place-items: center; font-size: 24px;
        }
        .info { flex: 1; min-width: 0; }
        .name { font-weight: 700; }
        .name span { color: var(--accent); font-family: var(--font-mono); font-size: var(--text-xs); }
        .dim { color: var(--fg-dim); font-size: var(--text-xs); margin-top: 2px; }
        .metric { text-align: right; display: flex; flex-direction: column; gap: 2px; }
        .metric label { color: var(--muted); font-size: var(--text-xs); }
        .metric strong { font-family: var(--font-mono); font-size: var(--text-sm); }
        .metric small { font-family: var(--font-mono); font-size: 11px; }
        .gain { color: var(--gain); } .loss { color: var(--loss); }
      `}</style>
    </div>
  );
}

const CTA = `
  .cta {
    padding: var(--space-2) var(--space-5); border-radius: var(--radius-full);
    background: var(--accent); color: var(--accent-fg); font-weight: 700;
  }
  .cta:hover { background: var(--accent-hover); }
`;
