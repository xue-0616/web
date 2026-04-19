/**
 * Theme toggle — flips `data-theme` on <html>. The token CSS watches
 * `[data-theme="light"]` to swap background/foreground pairs.
 */
import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const saved = (window.localStorage.getItem(KEY) as Theme | null) ?? "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);
  const set = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    window.localStorage.setItem(KEY, t);
  };
  return { theme, set, toggle: () => set(theme === "dark" ? "light" : "dark") };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} className="theme" aria-label="Toggle theme" title={`Switch to ${theme === "dark" ? "light" : "dark"}`}>
      {theme === "dark" ? "🌙" : "☀️"}
      <style>{`
        .theme {
          width: 36px; height: 36px; border-radius: var(--radius-full);
          background: var(--surface-2); color: var(--fg);
          font-size: 16px;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .theme:hover { background: var(--border); transform: rotate(15deg); }
      `}</style>
    </button>
  );
}
