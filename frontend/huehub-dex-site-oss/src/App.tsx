import { useState } from "react";

import { SwapPanel } from "./components/SwapPanel";
import { TokensPage } from "./components/TokensPage";
import { PortfolioPage } from "./components/PortfolioPage";
import { LimitPage } from "./components/LimitPage";
import { WalletButton, WalletModal, useWalletConnection } from "./lib/wallet";
import { ThemeToggle } from "./lib/theme";
import { LangToggle } from "./lib/i18n";

type Tab = "swap" | "tokens" | "portfolio" | "limit";

export function App() {
  const [tab, setTab] = useState<Tab>("swap");
  const w = useWalletConnection();

  return (
    <div className="shell">
      <header>
        <div className="brand"><span className="mark" aria-hidden>◈</span>HueHub</div>
        <nav>
          <button data-on={tab === "swap"} onClick={() => setTab("swap")}>Swap</button>
          <button data-on={tab === "limit"} onClick={() => setTab("limit")}>Limit</button>
          <button data-on={tab === "tokens"} onClick={() => setTab("tokens")}>Tokens</button>
          <button data-on={tab === "portfolio"} onClick={() => setTab("portfolio")}>Portfolio</button>
        </nav>
        <div className="ctl">
          <LangToggle />
          <ThemeToggle />
          <WalletButton wallet={w.wallet} onConnectClick={() => w.setOpen(true)} onDisconnect={w.disconnect} />
        </div>
      </header>

      <main>
        {tab === "swap" && (
          <>
            <div className="hero">
              <h1>The best price on Solana, every time.</h1>
              <p>Aggregated across 30+ DEXs via Jupiter. Zero platform fee.</p>
            </div>
            <SwapPanel />
          </>
        )}
        {tab === "limit" && <LimitPage />}
        {tab === "tokens" && <TokensPage onPick={() => setTab("swap")} />}
        {tab === "portfolio" && <PortfolioPage wallet={w.wallet} onConnect={() => w.setOpen(true)} />}
      </main>

      <WalletModal open={w.open} onClose={() => w.setOpen(false)} onPick={w.connect} />

      <style>{`
        .shell { min-height: 100vh; display: flex; flex-direction: column; }
        header {
          display: flex; gap: var(--space-8); align-items: center;
          padding: var(--space-4) var(--space-8);
          border-bottom: 1px solid var(--border);
        }
        .brand { font-size: var(--text-xl); font-weight: 800; display: flex; gap: var(--space-2); align-items: center; }
        .mark { color: var(--accent); filter: drop-shadow(0 0 8px var(--accent-ghost)); }
        header nav { display: flex; gap: var(--space-2); margin-left: var(--space-6); }
        header nav button { padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); color: var(--fg-dim); font-weight: 500; font-size: var(--text-sm); }
        header nav button[data-on="true"] { background: var(--accent-ghost); color: var(--accent); }
        header nav button:not([data-on="true"]):hover { background: var(--surface-2); color: var(--fg); }
        .ctl { display: flex; gap: var(--space-2); align-items: center; margin-left: auto; }
        main { flex: 1; max-width: 1040px; width: 100%; margin: 0 auto; padding: var(--space-10) var(--space-6); display: flex; flex-direction: column; gap: var(--space-8); }
        .hero { text-align: center; max-width: 560px; margin: 0 auto; }
        .hero h1 { margin: 0; font-size: var(--text-3xl); letter-spacing: -0.02em; }
        .hero p { margin: var(--space-3) 0 0; color: var(--fg-dim); }
        @media (max-width: 760px) {
          header { flex-wrap: wrap; gap: var(--space-3); padding: var(--space-3) var(--space-4); }
          header nav { order: 3; width: 100%; margin: 0; justify-content: center; overflow-x: auto; }
          .ctl { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
