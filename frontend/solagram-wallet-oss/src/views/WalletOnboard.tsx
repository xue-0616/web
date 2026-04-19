import { useMemo, useState } from "react";

import { createWallet } from "../lib/vault";
import { newMnemonic, isValidMnemonic } from "../lib/keypair";

/**
 * First-run. Two flows:
 *   - Create: we generate a fresh 12-word BIP-39 mnemonic, show it once,
 *     then gate on the encryption passphrase.
 *   - Import: user pastes an existing mnemonic; we validate its checksum
 *     before letting them proceed to the passphrase step.
 *
 * In both flows the final step encrypts the derived ed25519 secretKey with
 * XChaCha20-Poly1305 using a scrypt-derived KEK and persists the blob to
 * Telegram cloud storage (or localStorage outside TG).
 */
export function WalletOnboard({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"create" | "import">("create");
  const [step, setStep] = useState<"choose" | "seed" | "pass">("choose");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [importSeed, setImportSeed] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Generate once per component mount — regenerating on every render would
  // invalidate the words the user just wrote down.
  const generated = useMemo(() => newMnemonic(), []);

  const seedWords = (mode === "create" ? generated : importSeed).trim().split(/\s+/).filter(Boolean);

  const proceedFromSeed = () => {
    setErr("");
    if (mode === "import") {
      if (!isValidMnemonic(importSeed)) return setErr("Invalid recovery phrase. Check the words and spacing.");
    }
    setStep("pass");
  };

  const finish = async () => {
    setErr("");
    if (pass.length < 8) return setErr("Passphrase must be at least 8 chars.");
    if (pass !== confirm) return setErr("Passphrases don't match.");
    setBusy(true);
    try {
      await createWallet(pass, mode === "import" ? { mnemonic: importSeed } : {});
      onDone();
    } catch (e) {
      setErr((e as Error).message || "Could not create wallet.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "choose") {
    return (
      <section className="card">
        <h2>Welcome to Solagram</h2>
        <p>Your non-custodial Solana wallet inside Telegram.</p>
        <button className="primary" onClick={() => { setMode("create"); setStep("seed"); }}>Create a new wallet</button>
        <button className="ghost" onClick={() => { setMode("import"); setStep("seed"); }}>I have a seed phrase</button>
        <Style />
      </section>
    );
  }

  if (step === "seed" && mode === "create") {
    return (
      <section className="card">
        <h2>Your recovery phrase</h2>
        <p>Write these 12 words down somewhere safe. Solagram can never recover them for you.</p>
        <div className="seed">
          {seedWords.map((w, i) => (
            <span key={i}><em>{i + 1}.</em>{w}</span>
          ))}
        </div>
        <button className="primary" onClick={() => setStep("pass")}>I wrote them down</button>
        <Style />
      </section>
    );
  }

  if (step === "seed" && mode === "import") {
    return (
      <section className="card">
        <h2>Import a recovery phrase</h2>
        <p>Paste the 12 or 24 words separated by spaces. We validate the BIP-39 checksum before continuing.</p>
        <label>
          <span>Recovery phrase</span>
          <textarea
            rows={4}
            value={importSeed}
            onChange={(e) => setImportSeed(e.target.value)}
            placeholder="word1 word2 word3 …"
          />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="primary" onClick={proceedFromSeed} disabled={importSeed.trim().split(/\s+/).length < 12}>
          Continue
        </button>
        <Style />
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Protect your wallet</h2>
      <p>This passphrase encrypts your keys on-device. We cannot recover it.</p>
      <label>
        <span>Passphrase (≥ 8 chars)</span>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      <label>
        <span>Confirm</span>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {err && <div className="err">{err}</div>}
      <button className="primary" onClick={finish} disabled={busy}>
        {busy ? "Encrypting…" : "Finish setup"}
      </button>
      <Style />
    </section>
  );
}

function Style() {
  return (
    <style>{`
      .card {
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--space-6);
        display: flex; flex-direction: column; gap: var(--space-4);
      }
      .card h2 { margin: 0; font-size: var(--text-2xl); letter-spacing: -0.02em; }
      .card p { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); }
      .primary {
        padding: var(--space-3); border-radius: var(--radius-md);
        background: var(--accent); color: var(--accent-fg);
        font-weight: 700; font-size: var(--text-base);
      }
      .primary:hover { background: var(--accent-hover); }
      .ghost {
        padding: var(--space-3); border-radius: var(--radius-md);
        background: transparent; color: var(--fg);
        border: 1px solid var(--border-bright);
      }
      .ghost:hover { background: var(--surface-2); }
      .seed {
        display: grid; grid-template-columns: 1fr 1fr;
        gap: var(--space-2);
        padding: var(--space-4);
        background: var(--surface-2); border-radius: var(--radius-md);
        font-family: var(--font-mono); font-size: var(--text-sm);
      }
      .seed span em {
        color: var(--muted); font-style: normal; font-size: var(--text-xs);
        margin-right: var(--space-2);
      }
      label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); color: var(--fg-dim); }
      label input, label textarea {
        padding: var(--space-3); background: var(--surface-2); border: 1px solid var(--border);
        border-radius: var(--radius-md); color: var(--fg);
        font-family: inherit; resize: vertical;
      }
      label input:focus, label textarea:focus { border-color: var(--accent); outline: none; }
      .err { padding: var(--space-3); background: #f43f5e15; border-radius: var(--radius-md); color: var(--loss); font-size: var(--text-sm); }
    `}</style>
  );
}
