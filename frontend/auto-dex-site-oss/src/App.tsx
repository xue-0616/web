import { useState } from "react";

import { StrategyGrid } from "./components/StrategyGrid";
import { PositionsTable } from "./components/PositionsTable";
import { History } from "./components/History";
import { WalletButton, WalletModal, useWalletConnection } from "./lib/wallet";
import { ThemeToggle } from "./lib/theme";
import { LangToggle } from "./lib/i18n";

export function App() {
  const [tab, setTab] = useState<"strategies" | "positions" | "history">("strategies");
  const w = useWalletConnection();

  return (
    <div className="shell">
      <header>
        <div className="brand"><span className="mark" aria-hidden>▲</span>HueHub <em>Auto</em></div>
        <nav>
          <button data-on={tab === "strategies"} onClick={() => setTab("strategies")}>Strategies</button>
          <button data-on={tab === "positions"} onClick={() => setTab("positions")}>Positions</button>
          <button data-on={tab === "history"} onClick={() => setTab("history")}>History</button>
        </nav>
        <div className="ctl">
          <LangToggle />
          <ThemeToggle />
          <WalletButton wallet={w.wallet} onConnectClick={() => w.setOpen(true)} onDisconnect={w.disconnect} />
        </div>
      </header>

      <main>
        {tab === "strategies" && <StrategyGrid />}
        {tab === "positions" && <PositionsTable />}
        {tab === "history" && <History />}
      </main>

      <WalletModal open={w.open} onClose={() => w.setOpen(false)} onPick={w.connect} />

      <style>{`
        .shell { max-width: 1200px; margin: 0 auto; padding: var(--space-6); }
        header {
          display: flex; align-items: center; gap: var(--space-4);
          padding: var(--space-3) var(--space-5);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-full);
        }
        .brand { font-weight: 800; font-size: var(--text-lg); display: flex; gap: var(--space-2); align-items: center; }
        .brand em { color: var(--accent); font-style: normal; font-family: var(--font-mono); }
        .mark { color: var(--accent); filter: drop-shadow(0 0 8px var(--accent-ghost)); }
        header nav { display: flex; gap: var(--space-1); margin: 0 auto; }
        header nav button { padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); color: var(--fg-dim); font-weight: 600; font-size: var(--text-sm); }
        header nav button[data-on="true"] { background: var(--accent-ghost); color: var(--accent); }
        header nav button:not([data-on="true"]):hover { background: var(--surface-2); color: var(--fg); }
        .ctl { display: flex; gap: var(--space-2); align-items: center; }
        main { margin-top: var(--space-8); }
        @media (max-width: 760px) {
          header { flex-wrap: wrap; border-radius: var(--radius-lg); }
          header nav { order: 3; width: 100%; margin: 0; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
