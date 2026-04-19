"use client";
import { useEffect, useState } from "react";

import type { ActionGetResponse } from "@/lib/action";

/**
 * Mirrors how Dialect / Phantom render a Blink preview card: fetches
 * the Action GET endpoint, displays title + description + action
 * buttons. Clicking a preset simulates a Blink's "execute" flow by
 * POSTing {account: <dummy>} to the route and showing the returned
 * `message`.
 *
 * This component is deliberately client-rendered so devs can iterate
 * on their Action handler and see the preview refresh without a
 * full page reload.
 */
export function BlinkPreview() {
  const [url, setUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<ActionGetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const stored = window.localStorage.getItem("blink:preview-url");
      setUrl(stored);
    };
    read();
    window.addEventListener("blink:url-changed", read);
    return () => window.removeEventListener("blink:url-changed", read);
  }, []);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setErr(null);
    setResultMsg(null);
    fetch(url, { headers: { accept: "application/json" } })
      .then(async (r) => {
        const j = (await r.json()) as ActionGetResponse;
        if (!r.ok || j.disabled) throw new Error(j.error?.message ?? j.description);
        setMeta(j);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [url]);

  const execute = async (actionHref: string) => {
    setResultMsg("Signing…");
    try {
      const resp = await fetch(actionHref, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp9PVbYDQ7F6wV" }),
      });
      const j = (await resp.json()) as { message?: string; transaction?: string };
      if (!resp.ok) throw new Error(j.message ?? "Rejected by server");
      setResultMsg(j.message ?? `Got transaction (${(j.transaction ?? "").length} bytes base64).`);
    } catch (e) {
      setResultMsg(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="card" aria-live="polite">
      <h2>Preview</h2>
      <p className="dim">As it would render in-feed (Twitter / Phantom / Dialect).</p>

      {!url && <div className="placeholder">Apply a URL from the builder →</div>}
      {url && loading && <div className="placeholder">Loading metadata…</div>}
      {url && err && <div className="error">Error: {err}</div>}
      {url && meta && (
        <article className="blink">
          <div className="icon-tile">◎</div>
          <div className="body">
            <h3>{meta.title}</h3>
            <p>{meta.description}</p>
            <div className="actions">
              {(meta.links?.actions ?? [{ label: meta.label, href: url }]).map((a) => (
                <button key={a.href} onClick={() => execute(a.href)}>{a.label}</button>
              ))}
            </div>
            {resultMsg && <div className="result">{resultMsg}</div>}
          </div>
        </article>
      )}

      <style jsx>{`
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          display: flex; flex-direction: column; gap: var(--space-4);
        }
        h2 { margin: 0; font-size: var(--text-xl); }
        .dim { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); }
        .placeholder {
          padding: var(--space-8); text-align: center;
          background: var(--surface-2); border-radius: var(--radius-md);
          color: var(--muted); font-size: var(--text-sm);
          border: 1px dashed var(--border-bright);
        }
        .error {
          padding: var(--space-4); border-radius: var(--radius-md);
          background: #f43f5e15; color: var(--loss); font-size: var(--text-sm);
        }
        .blink {
          display: flex; gap: var(--space-4);
          padding: var(--space-5);
          border: 1px solid var(--border-bright); border-radius: var(--radius-lg);
          background: var(--surface-2);
        }
        .icon-tile {
          width: 48px; height: 48px; flex-shrink: 0;
          display: grid; place-items: center;
          background: var(--accent-ghost); color: var(--accent);
          border-radius: var(--radius-md); font-size: 24px;
        }
        .body { flex: 1; }
        .body h3 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
        .body p { margin: 0 0 var(--space-4); color: var(--fg-dim); font-size: var(--text-sm); }
        .actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .actions button {
          padding: var(--space-2) var(--space-4); border-radius: var(--radius-full);
          background: var(--accent); color: var(--accent-fg);
          font-weight: 600; font-size: var(--text-sm);
        }
        .actions button:hover { background: var(--accent-hover); }
        .result {
          margin-top: var(--space-4);
          padding: var(--space-3); border-radius: var(--radius-md);
          background: var(--surface); color: var(--fg-dim); font-size: var(--text-xs);
          font-family: var(--font-mono);
        }
      `}</style>
    </section>
  );
}
