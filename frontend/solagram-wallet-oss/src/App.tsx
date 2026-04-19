import { useEffect, useState } from "react";

import { WalletHome } from "./views/WalletHome";
import { WalletOnboard } from "./views/WalletOnboard";
import { ThemeToggle } from "./lib/theme";
import { LangToggle } from "./lib/i18n";
import { hasWallet, destroyWallet } from "./lib/vault";

interface TgWebApp {
  ready: () => void;
  expand: () => void;
  themeParams?: Record<string, string>;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
}

export function App() {
  const [ctx, setCtx] = useState<"tg" | "browser">("browser");
  const [exists, setExists] = useState<boolean | null>(null);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const win = window as unknown as { Telegram?: { WebApp?: TgWebApp } };
    const tg = win.Telegram?.WebApp;
    if (tg) {
      setCtx("tg");
      tg.ready?.();
      tg.expand?.();
      setUser(tg.initDataUnsafe?.user?.first_name ?? tg.initDataUnsafe?.user?.username ?? null);
    }
    hasWallet().then((v) => setExists(v));
  }, []);

  const lock = async () => {
    // "Lock" in this UI means full sign-out — we destroy the on-device
    // blob so the next launch starts at the passphrase gate. The seed
    // phrase the user wrote down is the only way back in.
    await destroyWallet();
    setExists(false);
  };

  if (exists === null) {
    return <div className="boot">Loading…<style>{`.boot{padding:var(--space-12);text-align:center;color:var(--muted);}`}</style></div>;
  }

  return (
    <div className="app">
      <header>
        <div className="brand"><span className="mark" aria-hidden>◉</span> Solagram</div>
        <div className="ctx">
          {ctx === "tg" ? `👤 ${user ?? "anon"}` : "🖥️ preview"}
        </div>
        <div className="controls">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      {exists
        ? <WalletHome onLock={lock} />
        : <WalletOnboard onDone={() => setExists(true)} />}

      <style>{`
        .app { max-width: 420px; margin: 0 auto; min-height: 100vh; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); }
        header {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .brand { font-weight: 700; font-size: var(--text-lg); display: flex; gap: var(--space-2); align-items: center; }
        .mark { color: var(--accent); filter: drop-shadow(0 0 6px var(--accent-ghost)); }
        .ctx { color: var(--muted); font-size: var(--text-xs); font-family: var(--font-mono); }
        .controls { margin-left: auto; display: flex; gap: var(--space-1); }
      `}</style>
    </div>
  );
}
