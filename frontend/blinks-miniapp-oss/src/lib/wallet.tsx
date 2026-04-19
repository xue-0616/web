/**
 * Wallet connection modal. Mock adapter that simulates the
 * `@solana/wallet-adapter` flow without pulling the real dependency.
 *
 * Real production code would:
 *   1. Read from `useWallet()` of `@solana/wallet-adapter-react`
 *   2. Map our WalletKind → corresponding `WalletAdapter` instance
 *   3. Call `.connect()` and surface the returned publicKey
 *
 * UX is identical; swapping in the real adapter is a ~30-line patch.
 */
import { useEffect, useState } from "react";

export type WalletKind = "phantom" | "backpack" | "solflare" | "ledger";

export interface ConnectedWallet {
  kind: WalletKind;
  address: string;
  label: string;
}

export const WALLETS: Array<{ kind: WalletKind; label: string; icon: string; installed: boolean }> = [
  { kind: "phantom",  label: "Phantom",  icon: "👻", installed: true  },
  { kind: "backpack", label: "Backpack", icon: "🎒", installed: true  },
  { kind: "solflare", label: "Solflare", icon: "🔥", installed: false },
  { kind: "ledger",   label: "Ledger",   icon: "🔐", installed: false },
];

const STORAGE_KEY = "wallet:connection";

export function readStoredWallet(): ConnectedWallet | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConnectedWallet) : null;
  } catch { return null; }
}

function writeStoredWallet(w: ConnectedWallet | null) {
  if (w) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
  else window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Mint a plausible-looking base58-ish address for the given wallet kind.
 * Deterministic so repeat "connects" show the same address.
 */
function mockAddress(kind: WalletKind): string {
  const seeds: Record<WalletKind, string> = {
    phantom:  "7sPtz9DkVpQ3mBgKz1xRy",
    backpack: "Bp4kAjH2mQ9vRz8nYwXsF",
    solflare: "SfLr3ErBn5cVpDg7WjKyZ",
    ledger:   "LdGrYp8HvKmNqX2rTzAbC",
  };
  const seed = seeds[kind];
  return `${seed}${"a4f7b2c9e8d5"}${seed.slice(0, 4)}`;
}

export function useWalletConnection() {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { setWallet(readStoredWallet()); }, []);

  const connect = (kind: WalletKind) => {
    const next: ConnectedWallet = {
      kind,
      address: mockAddress(kind),
      label: WALLETS.find((w) => w.kind === kind)?.label ?? kind,
    };
    writeStoredWallet(next);
    setWallet(next);
    setOpen(false);
  };
  const disconnect = () => { writeStoredWallet(null); setWallet(null); };
  return { wallet, open, setOpen, connect, disconnect };
}

export function shortAddr(addr: string, chars = 4): string {
  return addr.length <= chars * 2 + 1 ? addr : `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function WalletModal({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: WalletKind) => void;
}) {
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Connect a wallet</h3>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <p className="intro">
          By connecting a wallet, you agree to the Terms of Service. We
          never take custody of your funds.
        </p>
        <ul>
          {WALLETS.map((w) => (
            <li key={w.kind}>
              <button onClick={() => onPick(w.kind)} disabled={!w.installed}>
                <span className="icon" aria-hidden>{w.icon}</span>
                <span className="label">{w.label}</span>
                {w.installed
                  ? <span className="tag ok">Detected</span>
                  : <span className="tag">Not installed</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        .scrim {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
          display: grid; place-items: center; padding: var(--space-4);
        }
        .modal {
          width: 100%; max-width: 400px;
          background: var(--surface); border: 1px solid var(--border-bright);
          border-radius: var(--radius-lg);
          padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4);
        }
        header { display: flex; align-items: center; }
        h3 { margin: 0; font-size: var(--text-lg); }
        .close {
          margin-left: auto; width: 30px; height: 30px; border-radius: var(--radius-full);
          color: var(--muted); font-size: 22px;
        }
        .close:hover { background: var(--surface-2); color: var(--fg); }
        .intro { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); }
        ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
        ul button {
          width: 100%; display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3); border-radius: var(--radius-md);
          background: var(--surface-2); color: var(--fg);
          text-align: left; font-weight: 600;
        }
        ul button:hover:not(:disabled) { background: var(--border); }
        ul button:disabled { opacity: 0.4; cursor: not-allowed; }
        .icon { width: 28px; font-size: 22px; text-align: center; }
        .label { flex: 1; }
        .tag { font-size: var(--text-xs); color: var(--muted); font-weight: 500; }
        .tag.ok { color: var(--gain); }
      `}</style>
    </div>
  );
}

export function WalletButton({
  wallet, onConnectClick, onDisconnect,
}: {
  wallet: ConnectedWallet | null;
  onConnectClick: () => void;
  onDisconnect: () => void;
}) {
  const [menu, setMenu] = useState(false);
  if (!wallet) {
    return <button className="connect" onClick={onConnectClick}>Connect wallet<style>{STYLE}</style></button>;
  }
  return (
    <div className="holder">
      <button className="connected" onClick={() => setMenu((m) => !m)}>
        <span className="dot" aria-hidden />
        {shortAddr(wallet.address)}
        <span className="chev" aria-hidden>▾</span>
      </button>
      {menu && (
        <div className="menu" role="menu">
          <button onClick={() => { navigator.clipboard.writeText(wallet.address); setMenu(false); }}>
            Copy address
          </button>
          <button onClick={() => { setMenu(false); onDisconnect(); }}>Disconnect</button>
        </div>
      )}
      <style>{STYLE}</style>
    </div>
  );
}

const STYLE = `
  .connect {
    padding: var(--space-2) var(--space-5); border-radius: var(--radius-full);
    background: var(--accent); color: var(--accent-fg);
    font-weight: 700; font-size: var(--text-sm);
  }
  .connect:hover { background: var(--accent-hover); }
  .holder { position: relative; }
  .connected {
    display: flex; align-items: center; gap: var(--space-2);
    padding: var(--space-2) var(--space-4); border-radius: var(--radius-full);
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--fg); font-weight: 600; font-size: var(--text-sm);
    font-family: var(--font-mono);
  }
  .connected:hover { border-color: var(--accent); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--gain); box-shadow: 0 0 6px var(--gain); }
  .chev { color: var(--muted); font-size: 10px; }
  .menu {
    position: absolute; right: 0; top: calc(100% + 4px);
    min-width: 180px; z-index: 10;
    background: var(--surface); border: 1px solid var(--border-bright);
    border-radius: var(--radius-md); padding: var(--space-1);
    box-shadow: var(--shadow-lg);
    display: flex; flex-direction: column;
  }
  .menu button {
    padding: var(--space-2) var(--space-3); text-align: left;
    color: var(--fg); font-size: var(--text-sm); border-radius: var(--radius-sm);
  }
  .menu button:hover { background: var(--surface-2); }
`;
