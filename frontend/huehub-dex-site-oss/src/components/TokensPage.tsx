import { useMemo, useState } from "react";
import { TOKENS, type TokenInfo } from "../lib/swap";

interface Row extends TokenInfo {
  change24h: number;
  volume24hUsd: number;
  marketCapUsd: number;
}

function withStats(t: TokenInfo, i: number): Row {
  // Deterministic pseudo-stats so the table looks realistic in previews.
  const h = [...t.symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  const change = ((h % 100) - 40) / 10;  // −4% .. +6%
  return {
    ...t,
    change24h: change,
    volume24hUsd: (h * 1_000_000) * (1 + (i / 10)),
    marketCapUsd: (h * 10_000_000) * (1 + i),
  };
}

type SortKey = "name" | "price" | "change" | "volume" | "mcap";

export function TokensPage({ onPick }: { onPick: (t: TokenInfo) => void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("volume");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const base = TOKENS.map(withStats);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter((r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.mint.toLowerCase().includes(q))
      : base;
    const accessors: Record<SortKey, (r: Row) => number | string> = {
      name: (r) => r.name,
      price: (r) => r.priceUsd,
      change: (r) => r.change24h,
      volume: (r) => r.volume24hUsd,
      mcap: (r) => r.marketCapUsd,
    };
    return [...filtered].sort((a, b) => {
      const av = accessors[sort](a), bv = accessors[sort](b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return dir === "asc" ? cmp : -cmp;
    });
  }, [query, sort, dir]);

  const toggleSort = (k: SortKey) => {
    if (k === sort) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(k); setDir("desc"); }
  };
  const arrow = (k: SortKey) => sort === k ? (dir === "asc" ? "▲" : "▼") : "";

  return (
    <div className="wrap">
      <header>
        <h1>Tokens</h1>
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symbol, name, or mint…"
        />
      </header>

      <table>
        <thead>
          <tr>
            <th><button onClick={() => toggleSort("name")}>Token {arrow("name")}</button></th>
            <th className="num"><button onClick={() => toggleSort("price")}>Price {arrow("price")}</button></th>
            <th className="num"><button onClick={() => toggleSort("change")}>24h % {arrow("change")}</button></th>
            <th className="num"><button onClick={() => toggleSort("volume")}>Volume {arrow("volume")}</button></th>
            <th className="num"><button onClick={() => toggleSort("mcap")}>Market cap {arrow("mcap")}</button></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mint}>
              <td>
                <div className="tok">
                  <span className="logo">{r.logo}</span>
                  <div>
                    <div className="sym">{r.symbol}</div>
                    <div className="name">{r.name}</div>
                  </div>
                </div>
              </td>
              <td className="num mono">${fmtUsd(r.priceUsd)}</td>
              <td className={`num mono ${r.change24h >= 0 ? "gain" : "loss"}`}>
                {r.change24h >= 0 ? "+" : ""}{r.change24h.toFixed(2)}%
              </td>
              <td className="num mono dim">${fmtCompact(r.volume24hUsd)}</td>
              <td className="num mono dim">${fmtCompact(r.marketCapUsd)}</td>
              <td><button className="swap" onClick={() => onPick(r)}>Swap</button></td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="empty">No tokens match "{query}".</td></tr>
          )}
        </tbody>
      </table>

      <style>{`
        .wrap { display: flex; flex-direction: column; gap: var(--space-6); }
        header { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
        h1 { margin: 0; font-size: var(--text-3xl); letter-spacing: -0.02em; }
        .search {
          flex: 1; min-width: 240px;
          padding: var(--space-3) var(--space-4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-full); color: var(--fg);
        }
        .search:focus { border-color: var(--accent); outline: none; }

        table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        th, td { padding: var(--space-3) var(--space-4); text-align: left; font-size: var(--text-sm); }
        th { color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--border); }
        th button { color: var(--muted); font: inherit; padding: 0; }
        th button:hover { color: var(--fg); }
        .num { text-align: right; }
        .num button { display: block; margin-left: auto; }
        tbody tr { border-bottom: 1px solid var(--border); }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: var(--surface-2); }
        .tok { display: flex; gap: var(--space-3); align-items: center; }
        .logo { width: 32px; height: 32px; background: var(--surface-2); border-radius: var(--radius-full); display: grid; place-items: center; font-size: 18px; }
        .sym { font-weight: 700; }
        .name { color: var(--fg-dim); font-size: var(--text-xs); }
        .mono { font-family: var(--font-mono); }
        .dim { color: var(--fg-dim); }
        .gain { color: var(--gain); } .loss { color: var(--loss); }
        .swap { padding: var(--space-1) var(--space-4); border-radius: var(--radius-full); background: var(--accent-ghost); color: var(--accent); font-weight: 600; font-size: var(--text-xs); }
        .swap:hover { background: var(--accent); color: var(--accent-fg); }
        .empty { text-align: center; padding: var(--space-8); color: var(--muted); }
      `}</style>
    </div>
  );
}

function fmtUsd(v: number): string {
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  return v.toExponential(2);
}

function fmtCompact(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(0);
}
