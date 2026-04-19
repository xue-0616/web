"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * Analytics page — mock dashboard for Blink creators.
 *
 * Metrics exposed:
 *   • impressions (GET /actions/*.json)
 *   • confirmations (POST returning a signed tx)
 *   • volume (sum of executed amounts, SOL)
 *   • conversion = confirmations / impressions
 *
 * Real data source (once wired) would be a `/v1/stats?actionId=…&range=…`
 * endpoint populated by the Rust Actions middleware. Here we deterministically
 * synthesise a series so the dashboard is useful for UX review.
 */

type Range = "24h" | "7d" | "30d";

function series(days: number, seed: number): number[] {
  return Array.from({ length: days }, (_, i) => {
    const x = Math.sin((i + seed) * 1.37) * 0.5 + 0.5;
    const trend = 0.3 + (i / days) * 0.7;
    return Math.max(0, Math.round(x * trend * (1000 / days)));
  });
}

const RANGES: Record<Range, number> = { "24h": 24, "7d": 7, "30d": 30 };

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("7d");

  const data = useMemo(() => {
    const buckets = RANGES[range];
    const imp = series(buckets, 3);
    const conf = imp.map((v, i) => Math.floor(v * (0.12 + ((i * 13) % 7) / 100)));
    const vol = conf.map((v) => Number((v * (0.05 + ((v * 7) % 11) / 100)).toFixed(2)));
    return { imp, conf, vol };
  }, [range]);

  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const impTotal = sum(data.imp);
  const confTotal = sum(data.conf);
  const volTotal = Number(sum(data.vol).toFixed(2));
  const conversion = impTotal > 0 ? (confTotal / impTotal) * 100 : 0;

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <div className="logo" aria-hidden>📈</div>
          <h1>Blink Analytics</h1>
          <p>
            Funnel metrics for the Solana Actions you ship. Swap the range
            below to see how a campaign trended before, during, and after
            launch.
          </p>
        </div>
        <Link className="pill" href="/">← Back to builder</Link>
      </header>

      <div className="range">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <button key={r} data-on={range === r} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
      </div>

      <section className="kpis">
        <Kpi label="Impressions" value={impTotal.toLocaleString()} trend="+12.4%" up />
        <Kpi label="Confirmations" value={confTotal.toLocaleString()} trend="+8.1%" up />
        <Kpi label="Conversion" value={`${conversion.toFixed(2)}%`} trend="-0.3%" />
        <Kpi label="Volume (SOL)" value={volTotal.toLocaleString()} trend="+22.7%" up />
      </section>

      <section className="charts">
        <Chart title="Impressions over time" data={data.imp} color="var(--accent)" />
        <Chart title="Confirmations over time" data={data.conf} color="var(--gain)" />
      </section>

      <section className="top">
        <h2>Top performing Blinks</h2>
        <div className="top-list">
          {TOP.map((t) => (
            <div className="top-row" key={t.id}>
              <div>
                <div className="sym">{t.icon} <strong>{t.title}</strong></div>
                <div className="slug">{t.slug}</div>
              </div>
              <div className="cells">
                <span>{t.impressions.toLocaleString()}</span>
                <span>{t.conf.toLocaleString()}</span>
                <span>{((t.conf / t.impressions) * 100).toFixed(1)}%</span>
                <span>{t.sol.toFixed(2)} SOL</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .page { max-width: 1024px; margin: 0 auto; padding: var(--space-8) var(--space-6); display: flex; flex-direction: column; gap: var(--space-6); }
        .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); }
        .page-head h1 { margin: var(--space-2) 0 var(--space-2); font-size: var(--text-3xl); letter-spacing: -0.02em; }
        .page-head p { margin: 0; color: var(--fg-dim); max-width: 52ch; }
        .logo { font-size: 32px; }
        .pill { padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); border: 1px solid var(--border); color: var(--fg-dim); text-decoration: none; font-size: var(--text-sm); }
        .pill:hover { color: var(--fg); border-color: var(--accent); }

        .range { display: flex; gap: var(--space-1); padding: var(--space-1); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-full); width: fit-content; }
        .range button { padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); color: var(--fg-dim); font-weight: 600; font-size: var(--text-sm); }
        .range button[data-on="true"] { background: var(--accent); color: var(--accent-fg); }

        .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-4); }
        .charts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        @media (max-width: 720px) { .charts { grid-template-columns: 1fr; } }

        .top h2 { margin: 0 0 var(--space-4); font-size: var(--text-sm); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .top-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .top-row { display: grid; grid-template-columns: 1.2fr 2fr; gap: var(--space-4); padding: var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); align-items: center; }
        .sym { font-size: var(--text-base); }
        .slug { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--muted); }
        .cells { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); font-family: var(--font-mono); font-size: var(--text-sm); text-align: right; }
      `}</style>
    </main>
  );
}

function Kpi({ label, value, trend, up }: { label: string; value: string; trend: string; up?: boolean }) {
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      <div className={`t ${up ? "up" : "down"}`}>{trend}</div>
      <style>{`
        .kpi { padding: var(--space-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
        .l { color: var(--muted); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; }
        .v { margin: var(--space-2) 0 var(--space-1); font-size: var(--text-3xl); font-weight: 700; font-family: var(--font-mono); letter-spacing: -0.02em; }
        .t { font-size: var(--text-sm); font-weight: 600; }
        .t.up { color: var(--gain); } .t.down { color: var(--loss); }
      `}</style>
    </div>
  );
}

function Chart({ title, data, color }: { title: string; data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const w = 400, h = 120, pad = 8;
  const dx = (w - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * dx;
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const areaPath = `M ${pad},${h - pad} L ${points.split(" ").join(" L ")} L ${(w - pad).toFixed(1)},${h - pad} Z`;

  return (
    <div className="chart">
      <div className="title">{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={title}>
        <path d={areaPath} fill={color} opacity="0.15" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      </svg>
      <style>{`
        .chart { padding: var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
        .title { font-size: var(--text-sm); color: var(--muted); margin-bottom: var(--space-2); }
        svg { width: 100%; height: 120px; display: block; }
      `}</style>
    </div>
  );
}

const TOP = [
  { id: "1", icon: "💸", title: "Tip a creator", slug: "/actions/tip", impressions: 14823, conf: 2104, sol: 128.45 },
  { id: "2", icon: "❤️", title: "Donate to open-source", slug: "/actions/tip?amount=1", impressions: 9210, conf: 1145, sol: 84.10 },
  { id: "3", icon: "🎟️", title: "Season pass mint", slug: "/actions/mint/season-1", impressions: 6104, conf: 812, sol: 0 },
  { id: "4", icon: "🔁", title: "Swap SOL→USDC", slug: "/actions/swap", impressions: 4011, conf: 287, sol: 41.72 },
];
