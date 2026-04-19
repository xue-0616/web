import { useState } from "react";

import { RISK_COLOR, STRATEGIES, type StrategyTemplate } from "../lib/strategies";

export function StrategyGrid() {
  const [selected, setSelected] = useState<StrategyTemplate | null>(null);

  return (
    <div>
      <header className="head">
        <h1>Pick a strategy</h1>
        <p>All strategies run 24/7 on HueHub's executor backend. Deposit SOL + token collateral, set your rules, walk away.</p>
      </header>

      <div className="grid">
        {STRATEGIES.map((s) => (
          <article key={s.id} className="card" onClick={() => setSelected(s)}>
            <div className="top">
              <div className="icon">{s.icon}</div>
              <div className="risk" style={{ color: RISK_COLOR[s.risk] }}>{s.risk}</div>
            </div>
            <h3>{s.name}</h3>
            <p>{s.blurb}</p>
            <button className="configure">Configure →</button>
          </article>
        ))}
      </div>

      {selected && <ConfigModal template={selected} onClose={() => setSelected(null)} />}

      <style>{`
        .head { margin-bottom: var(--space-10); max-width: 640px; }
        .head h1 { margin: 0; font-size: var(--text-3xl); letter-spacing: -0.02em; }
        .head p { margin: var(--space-3) 0 0; color: var(--fg-dim); }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
        .card {
          cursor: pointer;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-3);
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .top { display: flex; align-items: center; justify-content: space-between; }
        .icon {
          width: 40px; height: 40px; border-radius: var(--radius-md);
          background: var(--surface-2); display: grid; place-items: center;
          font-size: 20px;
        }
        .risk { text-transform: uppercase; font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.05em; }
        .card h3 { margin: 0; font-size: var(--text-lg); }
        .card p { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); min-height: 42px; }
        .configure { margin-top: auto; padding: var(--space-2); border-radius: var(--radius-md); background: var(--accent-ghost); color: var(--accent); font-weight: 600; font-size: var(--text-sm); }
        .card:hover .configure { background: var(--accent); color: var(--accent-fg); }
      `}</style>
    </div>
  );
}

function ConfigModal({ template, onClose }: { template: StrategyTemplate; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(template.params.map((p) => [p.key, p.default ?? ""])),
  );

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="icon">{template.icon}</div>
          <div>
            <h3>{template.name}</h3>
            <p>{template.blurb}</p>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert(`Scaffold — would POST ${template.id} config: ${JSON.stringify(values)}`);
            onClose();
          }}
        >
          {template.params.map((p) => (
            <label key={p.key}>
              <span>{p.label}</span>
              <input
                type={p.kind === "number" ? "number" : "text"}
                value={values[p.key] ?? ""}
                onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
                placeholder={p.placeholder ?? ""}
                step="any"
              />
              {p.hint && <small>{p.hint}</small>}
            </label>
          ))}

          <div className="actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">Deploy strategy</button>
          </div>
        </form>
      </div>
      <style>{`
        .scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: grid; place-items: center; z-index: 100; padding: var(--space-4); }
        .modal { width: 100%; max-width: 520px; max-height: 90vh; overflow: auto; background: var(--surface); border: 1px solid var(--border-bright); border-radius: var(--radius-lg); padding: var(--space-6); }
        .modal header { display: flex; gap: var(--space-3); align-items: flex-start; margin-bottom: var(--space-6); }
        .modal header h3 { margin: 0; font-size: var(--text-xl); }
        .modal header p { margin: var(--space-1) 0 0; color: var(--fg-dim); font-size: var(--text-sm); }
        .icon { width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--accent-ghost); color: var(--accent); display: grid; place-items: center; font-size: 20px; flex-shrink: 0; }
        .close { margin-left: auto; width: 32px; height: 32px; border-radius: var(--radius-full); color: var(--muted); font-size: 24px; }
        .close:hover { background: var(--surface-2); color: var(--fg); }
        form { display: flex; flex-direction: column; gap: var(--space-4); }
        label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); color: var(--fg-dim); }
        label input { padding: var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--fg); }
        label input:focus { border-color: var(--accent); outline: none; }
        label small { color: var(--muted); font-size: var(--text-xs); }
        .actions { display: flex; gap: var(--space-3); margin-top: var(--space-3); }
        .actions button { flex: 1; padding: var(--space-3); border-radius: var(--radius-md); font-weight: 600; }
        .ghost { color: var(--fg); border: 1px solid var(--border-bright); }
        .ghost:hover { background: var(--surface-2); }
        .primary { background: var(--accent); color: var(--accent-fg); }
        .primary:hover { background: var(--accent-hover); }
      `}</style>
    </div>
  );
}
