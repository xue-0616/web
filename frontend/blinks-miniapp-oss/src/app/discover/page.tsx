"use client";

import Link from "next/link";

/**
 * Discover page — curated gallery of example Blinks.
 *
 * Each card links to an Actions URL the visitor can copy, paste into a
 * wallet that supports the Solana Actions spec, and execute. In a real
 * deployment the list would come from a registry endpoint; here it is
 * hand-curated so the page is useful without a backend.
 */

interface ExampleBlink {
  slug: string;
  title: string;
  tagline: string;
  category: "tip" | "donate" | "vote" | "mint" | "swap";
  actionUrl: string;
  icon: string;
}

const EXAMPLES: ExampleBlink[] = [
  {
    slug: "tip-creator",
    title: "Tip a creator",
    tagline: "Send SOL to any Solana wallet in one click.",
    category: "tip",
    actionUrl: "/api/actions/tip?to=5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp9PVbYDQ7F6wV",
    icon: "💸",
  },
  {
    slug: "donate-osf",
    title: "Donate to open-source",
    tagline: "Support the core tooling you depend on.",
    category: "donate",
    actionUrl: "/api/actions/tip?to=5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp9PVbYDQ7F6wV&amount=1",
    icon: "❤️",
  },
  {
    slug: "dao-vote",
    title: "Cast a DAO vote",
    tagline: "Approve or reject the current proposal.",
    category: "vote",
    actionUrl: "#",
    icon: "🗳️",
  },
  {
    slug: "mint-pass",
    title: "Mint the Season pass",
    tagline: "Free cNFT, one per wallet. Supply: 10,000.",
    category: "mint",
    actionUrl: "#",
    icon: "🎟️",
  },
  {
    slug: "swap-sol-usdc",
    title: "Swap SOL → USDC",
    tagline: "Jupiter-routed, auto-slippage, 1-click.",
    category: "swap",
    actionUrl: "#",
    icon: "🔁",
  },
  {
    slug: "tip-streamer",
    title: "Tip a streamer live",
    tagline: "Pop the Blink overlay mid-stream.",
    category: "tip",
    actionUrl: "/api/actions/tip?to=5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp9PVbYDQ7F6wV&amount=0.05",
    icon: "📺",
  },
];

export default function DiscoverPage() {
  const byCat = EXAMPLES.reduce<Record<string, ExampleBlink[]>>((acc, e) => {
    (acc[e.category] ||= []).push(e);
    return acc;
  }, {});
  const order: ExampleBlink["category"][] = ["tip", "donate", "vote", "mint", "swap"];

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <div className="logo" aria-hidden>🔭</div>
          <h1>Discover Blinks</h1>
          <p>
            Browse example Solana Actions you can paste into any compatible
            wallet or feed. Each card shows the live metadata served by its
            Action endpoint.
          </p>
        </div>
        <Link className="pill" href="/">← Back to builder</Link>
      </header>

      {order.map((cat) => (
        byCat[cat] && (
          <section key={cat} className="bucket">
            <h2>{cat}</h2>
            <ul className="grid" role="list">
              {byCat[cat].map((e) => (
                <li key={e.slug}>
                  <article className="card">
                    <div className="icn" aria-hidden>{e.icon}</div>
                    <h3>{e.title}</h3>
                    <p>{e.tagline}</p>
                    <div className="foot">
                      <code>{e.actionUrl}</code>
                      <button
                        className="copy"
                        data-url={e.actionUrl}
                        onClick={(ev) => {
                          const btn = ev.currentTarget as HTMLButtonElement;
                          navigator.clipboard.writeText(btn.dataset.url ?? "");
                          btn.textContent = "Copied!";
                          setTimeout(() => { btn.textContent = "Copy"; }, 1200);
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )
      ))}

      <style>{`
        .page { max-width: 1024px; margin: 0 auto; padding: var(--space-8) var(--space-6); display: flex; flex-direction: column; gap: var(--space-8); }
        .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); }
        .page-head h1 { margin: var(--space-2) 0 var(--space-2); font-size: var(--text-3xl); letter-spacing: -0.02em; }
        .page-head p { margin: 0; color: var(--fg-dim); max-width: 52ch; }
        .logo { font-size: 32px; }
        .pill { padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); border: 1px solid var(--border); color: var(--fg-dim); text-decoration: none; font-size: var(--text-sm); }
        .pill:hover { color: var(--fg); border-color: var(--accent); }

        .bucket { display: flex; flex-direction: column; gap: var(--space-4); }
        .bucket h2 { margin: 0; font-size: var(--text-sm); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
        .card {
          display: flex; flex-direction: column; gap: var(--space-2);
          padding: var(--space-5);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          transition: border-color 0.15s, transform 0.15s;
        }
        .card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .icn { font-size: 28px; }
        .card h3 { margin: 0; font-size: var(--text-lg); }
        .card p { margin: 0; color: var(--fg-dim); font-size: var(--text-sm); flex: 1; }
        .foot { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); }
        .foot code {
          flex: 1; font-family: var(--font-mono); font-size: var(--text-xs);
          padding: var(--space-1) var(--space-2);
          background: var(--surface-2); border-radius: var(--radius-sm);
          color: var(--fg-dim); overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
        }
        .copy { padding: var(--space-1) var(--space-3); border-radius: var(--radius-sm); background: var(--accent); color: var(--accent-fg); font-size: var(--text-xs); font-weight: 600; }
        .copy:hover { background: var(--accent-hover); }
      `}</style>
    </main>
  );
}
