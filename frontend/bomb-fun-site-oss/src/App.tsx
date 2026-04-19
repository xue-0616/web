import { useState } from "react";

import { TokenList } from "./components/TokenList";
import { TradePanel } from "./components/TradePanel";
import { LaunchForm } from "./components/LaunchForm";
import { MyLaunches } from "./components/MyLaunches";
import { WalletButton, WalletModal, useWalletConnection } from "./lib/wallet";
import { ThemeToggle } from "./lib/theme";
import { LangToggle } from "./lib/i18n";
import { MOCK_TOKENS, type LaunchedToken } from "./lib/mock-tokens";

type Tab = "explore" | "trade" | "launch" | "mine";

/**
 * Bomb.fun shell. Four tabs: Explore / Trade / Launch / My. Wallet
 * connection is handled by the shared `useWalletConnection()` hook;
 * the live address is displayed in the top-right.
 */
export function App() {
  const [tab, setTab] = useState<Tab>("explore");
  const [selected, setSelected] = useState<LaunchedToken | null>(null);
  const w = useWalletConnection();

  const pick = (t: LaunchedToken) => { setSelected(t); setTab("trade"); };

  return (
    <div className="shell">
      <header>
        <div className="logo"><span aria-hidden>💣</span> bomb.fun</div>
        <nav>
          <button data-on={tab === "explore"} onClick={() => setTab("explore")}>Explore</button>
          <button data-on={tab === "trade"} onClick={() => setTab("trade")} disabled={!selected}>
            {selected ? `Trade ${selected.symbol}` : "Trade"}
          </button>
          <button data-on={tab === "launch"} onClick={() => setTab("launch")}>+ Launch</button>
          <button data-on={tab === "mine"} onClick={() => setTab("mine")}>My</button>
        </nav>
        <div className="controls">
          <LangToggle />
          <ThemeToggle />
          <WalletButton wallet={w.wallet} onConnectClick={() => w.setOpen(true)} onDisconnect={w.disconnect} />
        </div>
      </header>

      <main>
        {tab === "explore" && <TokenList tokens={MOCK_TOKENS} onPick={pick} />}
        {tab === "trade" && selected && <TradePanel token={selected} onBack={() => setTab("explore")} />}
        {tab === "launch" && <LaunchForm />}
        {tab === "mine" && <MyLaunches wallet={w.wallet} onConnect={() => w.setOpen(true)} />}
      </main>

      <WalletModal open={w.open} onClose={() => w.setOpen(false)} onPick={w.connect} />

      <style>{`
        .shell { max-width: 1200px; margin: 0 auto; padding: var(--space-6) var(--space-6) var(--space-16); }
        header {
          display: flex; align-items: center; gap: var(--space-4);
          padding: var(--space-3) var(--space-4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-full);
          box-shadow: var(--shadow-md);
        }
        .logo { font-size: var(--text-xl); font-weight: 800; display: flex; gap: var(--space-2); align-items: center; }
        header nav { display: flex; gap: var(--space-1); margin: 0 auto; }
        header nav button {
          padding: var(--space-2) var(--space-4); border-radius: var(--radius-full);
          color: var(--fg-dim); font-weight: 600; font-size: var(--text-sm);
        }
        header nav button[data-on="true"] { background: var(--accent-ghost); color: var(--accent); }
        header nav button:not([data-on="true"]):hover { background: var(--surface-2); color: var(--fg); }
        header nav button:disabled { opacity: 0.4; cursor: not-allowed; }
        .controls { display: flex; gap: var(--space-2); align-items: center; }
        main { margin-top: var(--space-8); }
        @media (max-width: 820px) {
          header { flex-wrap: wrap; border-radius: var(--radius-lg); }
          header nav { order: 3; width: 100%; margin: 0; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
