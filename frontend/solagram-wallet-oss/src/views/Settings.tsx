import { useState } from "react";
import { useLang } from "../lib/i18n";
import { useTheme } from "../lib/theme";

/**
 * Settings screen — currency, language, theme, notifications, export
 * private key (gated behind passphrase re-entry). Real export path
 * decrypts the stored keyblob; here we gate but don't actually
 * reveal anything.
 */
export function Settings({ onBack, onLock }: { onBack: () => void; onLock: () => void }) {
  const { theme, set: setTheme } = useTheme();
  const { lang, set: setLang } = useLang();
  const [currency, setCurrency] = useState<"USD" | "EUR" | "CNY">("USD");
  const [notif, setNotif] = useState(true);
  const [showExport, setShowExport] = useState(false);

  return (
    <section className="settings">
      <button className="back" onClick={onBack}>← Back</button>
      <h2>Settings</h2>

      <Group title="Display">
        <Row label="Theme">
          <ToggleGroup value={theme} onChange={setTheme} options={[["dark", "Dark"], ["light", "Light"]]} />
        </Row>
        <Row label="Language">
          <ToggleGroup value={lang} onChange={setLang} options={[["en", "EN"], ["zh", "中"]]} />
        </Row>
        <Row label="Currency">
          <ToggleGroup value={currency} onChange={(v) => setCurrency(v as "USD")} options={[["USD", "USD"], ["EUR", "EUR"], ["CNY", "CNY"]]} />
        </Row>
      </Group>

      <Group title="Notifications">
        <Row label="Transaction alerts" hint="Push a Telegram message when a tx completes.">
          <Switch on={notif} onChange={setNotif} />
        </Row>
      </Group>

      <Group title="Security">
        <Row label="Biometric unlock" hint="Not available in this preview build." >
          <Switch on={false} disabled />
        </Row>
        <button className="export" onClick={() => setShowExport(true)}>Export private key</button>
        <button className="lock" onClick={onLock}>Lock wallet</button>
      </Group>

      <Group title="About">
        <Row label="Version"><span className="mono">0.1.0 (preview)</span></Row>
        <Row label="Support"><a href="#">@solagram_support</a></Row>
      </Group>

      {showExport && (
        <div className="scrim" onClick={() => setShowExport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ Export private key</h3>
            <p>
              Anyone with your private key can steal all your funds. Solagram
              will never ask for it. Re-enter your passphrase to proceed.
            </p>
            <input type="password" placeholder="Passphrase" />
            <div className="row">
              <button className="ghost" onClick={() => setShowExport(false)}>Cancel</button>
              <button className="danger">Reveal</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .settings { display: flex; flex-direction: column; gap: var(--space-4); }
        .back { align-self: flex-start; padding: var(--space-2); color: var(--fg-dim); }
        h2 { margin: 0; font-size: var(--text-2xl); }
        .export, .lock { padding: var(--space-3); border-radius: var(--radius-md); font-weight: 600; font-size: var(--text-sm); }
        .export { background: var(--surface-2); color: var(--fg); }
        .export:hover { background: var(--border); }
        .lock { background: color-mix(in srgb, var(--loss) 12%, var(--surface)); color: var(--loss); border: 1px solid color-mix(in srgb, var(--loss) 40%, var(--border)); }
        .lock:hover { background: color-mix(in srgb, var(--loss) 20%, var(--surface)); }
        .mono { font-family: var(--font-mono); }
        a { color: var(--accent); }
        .scrim { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: grid; place-items: center; padding: var(--space-4); }
        .modal { width: 100%; max-width: 360px; background: var(--surface); border: 1px solid var(--loss); border-radius: var(--radius-lg); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
        .modal h3 { margin: 0; font-size: var(--text-lg); color: var(--loss); }
        .modal p { margin: 0; font-size: var(--text-sm); color: var(--fg-dim); }
        .modal input { padding: var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--fg); }
        .modal .row { display: flex; gap: var(--space-2); }
        .modal button { flex: 1; padding: var(--space-3); border-radius: var(--radius-md); font-weight: 600; }
        .modal .ghost { background: transparent; border: 1px solid var(--border-bright); color: var(--fg); }
        .modal .danger { background: var(--loss); color: white; }
      `}</style>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grp">
      <h4>{title}</h4>
      <div className="body">{children}</div>
      <style>{`
        .grp { display: flex; flex-direction: column; gap: var(--space-2); }
        h4 { margin: 0; color: var(--muted); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; }
        .body { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column; }
        .body > * + * { border-top: 1px solid var(--border); }
      `}</style>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <div>
        <div className="lbl">{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      <div className="act">{children}</div>
      <style>{`
        .row { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-3) var(--space-4); }
        .lbl { font-size: var(--text-sm); font-weight: 500; }
        .hint { color: var(--muted); font-size: var(--text-xs); margin-top: 2px; }
        .act { margin-left: auto; }
      `}</style>
    </div>
  );
}

function ToggleGroup<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <div className="tg">
      {options.map(([k, label]) => (
        <button key={k} data-on={k === value} onClick={() => onChange(k)}>{label}</button>
      ))}
      <style>{`
        .tg { display: flex; gap: 2px; padding: 2px; background: var(--surface-2); border-radius: var(--radius-sm); }
        .tg button { padding: 4px 12px; border-radius: calc(var(--radius-sm) - 2px); color: var(--fg-dim); font-size: var(--text-xs); font-weight: 600; }
        .tg button[data-on="true"] { background: var(--accent); color: var(--accent-fg); }
      `}</style>
    </div>
  );
}

function Switch({ on, onChange, disabled }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button className="sw" data-on={on} disabled={disabled} onClick={() => !disabled && onChange?.(!on)}>
      <span />
      <style>{`
        .sw { width: 44px; height: 24px; border-radius: var(--radius-full); background: var(--surface-2); border: 1px solid var(--border); position: relative; transition: background 0.15s ease; }
        .sw[data-on="true"] { background: var(--accent); border-color: var(--accent); }
        .sw span { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: var(--fg); border-radius: 50%; transition: transform 0.15s ease; }
        .sw[data-on="true"] span { transform: translateX(20px); background: white; }
        .sw:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </button>
  );
}
