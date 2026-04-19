/**
 * Skeleton / Empty / Error — three components used across every page to
 * normalise loading and failure UI. Kept dependency-free so they can be
 * dropped into any project.
 */
import type { ReactNode } from "react";

export function Skeleton({ w = "100%", h = "1em", radius = "var(--radius-sm)" }: { w?: string; h?: string; radius?: string }) {
  return (
    <span style={{ display: "inline-block", width: w, height: h, borderRadius: radius, background: "linear-gradient(90deg, var(--surface-2), var(--border), var(--surface-2))", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </span>
  );
}

export function EmptyState({ title, hint, icon = "🕊️", action }: { title: string; hint?: string; icon?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="icon" aria-hidden>{icon}</div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
      <style>{`
        .empty {
          padding: var(--space-12) var(--space-4); text-align: center;
          background: var(--surface); border: 1px dashed var(--border);
          border-radius: var(--radius-lg);
          display: flex; flex-direction: column; gap: var(--space-2); align-items: center;
        }
        .icon { font-size: 48px; opacity: 0.7; }
        h3 { margin: 0; font-size: var(--text-lg); }
        p { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); max-width: 280px; }
      `}</style>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="err">
      <div className="icon" aria-hidden>⚠️</div>
      <div>
        <h3>Something went wrong</h3>
        <p>{message}</p>
      </div>
      {onRetry && <button onClick={onRetry}>Retry</button>}
      <style>{`
        .err {
          display: flex; gap: var(--space-3); align-items: center;
          padding: var(--space-4);
          background: color-mix(in srgb, var(--loss) 10%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--loss) 40%, var(--border));
          border-radius: var(--radius-md);
        }
        .icon { font-size: 28px; }
        h3 { margin: 0; font-size: var(--text-sm); }
        p { margin: 0; color: var(--fg-dim); font-size: var(--text-xs); }
        button {
          margin-left: auto;
          padding: var(--space-2) var(--space-4); border-radius: var(--radius-md);
          background: var(--accent); color: var(--accent-fg); font-weight: 600; font-size: var(--text-sm);
        }
      `}</style>
    </div>
  );
}
