import { BlinkPreview } from "@/components/BlinkPreview";
import { BuilderForm } from "@/components/BuilderForm";

/**
 * Landing page — dual-pane demo:
 *
 * - left: a form that builds an Actions URL from recipient + amount
 *   inputs (pure client, no tx yet)
 * - right: a live preview card rendering the current GET response
 *   as a Blink would in-feed (Dialect, Phantom, etc.)
 *
 * The actual Action handler lives in /api/actions/tip/route.ts. The
 * preview fetches that route and renders the returned title/desc/
 * action buttons, mimicking how downstream Blink clients behave.
 */
export default function Home() {
  return (
    <main className="page">
      <header className="page-head">
        <div>
          <div className="logo" aria-hidden="true">◎</div>
          <h1>Solana Blinks Playground</h1>
          <p>
            Build, preview, and test a Solana Action link before shipping
            it to a Twitter post or wallet feed.
          </p>
        </div>
        <nav className="nav">
          <a className="pill" href="/discover">Discover</a>
          <a className="pill" href="/analytics">Analytics</a>
          <a className="pill" href="https://solana.com/docs/advanced/actions" target="_blank" rel="noreferrer">
            Spec →
          </a>
        </nav>
      </header>

      <section className="grid">
        <BuilderForm />
        <BlinkPreview />
      </section>
    </main>
  );
}
