import { useMemo, useState } from "react";

import { Comments } from "./Comments";
import { Holders } from "./Holders";
import {
  lamportsToSol,
  progressToGraduation,
  quoteBuy,
  quoteSell,
  shortMint,
  spotPrice,
} from "../lib/curve";
import type { LaunchedToken } from "../lib/mock-tokens";
import { evaluateHoneypot, synthesizeSnapshot, type HoneypotVerdict } from "../lib/honeypot";

/**
 * Trade page for a specific token. Two sub-tabs on the right side:
 * Holders list and Comments chat. The left side is the buy/sell widget.
 */
export function TradePanel({ token, onBack }: { token: LaunchedToken; onBack: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tab, setTab] = useState<"holders" | "chat">("holders");
  const [amount, setAmount] = useState("0.1");

  const progress = progressToGraduation(token.curve);
  const price = spotPrice(token.curve);

  const quote = useMemo(() => {
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      if (side === "buy") {
        return { kind: "buy" as const, ...quoteBuy(token.curve, BigInt(Math.floor(n * 1e9))) };
      }
      return { kind: "sell" as const, ...quoteSell(token.curve, BigInt(Math.floor(n * 1e12))) };
    } catch (e) {
      return { kind: "error" as const, message: e instanceof Error ? e.message : String(e) };
    }
  }, [side, amount, token.curve]);

  const curvePoints = useMemo(() => sampleCurve(token.curve), [token.curve]);

  // Pre-trade honeypot check. Runs every render but is O(few µs) so no memo.
  // Only enforced on `buy`; sells are always allowed — the user already owns
  // the bag and needs to exit.
  const verdict: HoneypotVerdict = evaluateHoneypot(synthesizeSnapshot(token));
  const buyBlocked = side === "buy" && verdict.block;

  return (
    <div className="panel">
      <button className="back" onClick={onBack}>← Back</button>

      <header>
        <div className="emoji" aria-hidden>{token.emoji}</div>
        <div>
          <h2>{token.name} <span className="sym">${token.symbol}</span></h2>
          <p>{token.description}</p>
          <p className="mono dim">{shortMint(token.mint)} · launched by {token.creator}</p>
        </div>
      </header>

      <section className="chart">
        <svg viewBox="0 0 320 120" role="img" aria-label="Bonding curve">
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={curvePoints} />
          <line x1={progress * 320} y1="0" x2={progress * 320} y2="120" stroke="var(--accent-ghost)" strokeDasharray="4 4" />
        </svg>
        <div className="chart-labels">
          <span>Price per token (SOL)</span>
          <span className="mono">{price.toExponential(3)}</span>
          <span className="mono dim">{(progress * 100).toFixed(1)}% to graduation</span>
        </div>
      </section>

      <section className="trade">
        <div className="side-toggle">
          <button data-on={side === "buy"} onClick={() => setSide("buy")}>Buy</button>
          <button data-on={side === "sell"} onClick={() => setSide("sell")}>Sell</button>
        </div>
        <label>
          <span>{side === "buy" ? "Pay (SOL)" : "Sell (tokens × 1M)"}</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        {quote && quote.kind === "buy" && (
          <dl className="quote">
            <dt>You receive</dt><dd>~{(Number(quote.tokensOut) / 1e12).toFixed(3)}M {token.symbol}</dd>
            <dt>Fee</dt><dd>{lamportsToSol(quote.feeLamports, 5)} SOL</dd>
            <dt>Impact</dt><dd className={quote.priceImpactPct > 5 ? "warn" : ""}>{quote.priceImpactPct.toFixed(2)}%</dd>
          </dl>
        )}
        {quote && quote.kind === "sell" && (
          <dl className="quote">
            <dt>You receive</dt><dd>{lamportsToSol(quote.solOut, 5)} SOL</dd>
            <dt>Fee</dt><dd>{lamportsToSol(quote.feeLamports, 5)} SOL</dd>
            <dt>Impact</dt><dd className={quote.priceImpactPct > 5 ? "warn" : ""}>{quote.priceImpactPct.toFixed(2)}%</dd>
          </dl>
        )}
        {quote && quote.kind === "error" && <div className="err">{quote.message}</div>}
        {side === "buy" && verdict.signals.length > 0 && (
          <div className={`risk risk-${verdict.block ? "danger" : "warn"}`} role="alert">
            <div className="risk-head">
              <span className="risk-dot" aria-hidden>●</span>
              <strong>{verdict.block ? "Honeypot signals detected" : "Exercise caution"}</strong>
              <span className="risk-score">{verdict.riskScore}/100</span>
            </div>
            <ul>
              {verdict.signals.slice(0, 3).map((s) => (
                <li key={s.code}><em>{s.severity}</em> {s.title}</li>
              ))}
            </ul>
          </div>
        )}
        <button className="commit" disabled={buyBlocked} title={buyBlocked ? "Blocked: honeypot signals present" : undefined}>
          {buyBlocked ? "Buy blocked — review risks" : side === "buy" ? "Confirm buy" : "Confirm sell"}
        </button>
      </section>

      <section className="side">
        <div className="tab-strip">
          <button data-on={tab === "holders"} onClick={() => setTab("holders")}>Holders</button>
          <button data-on={tab === "chat"} onClick={() => setTab("chat")}>Chat</button>
        </div>
        {tab === "holders" ? <Holders mint={token.mint} /> : <Comments />}
      </section>

      <style>{`
        .panel {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          grid-template-areas:
            "back back"
            "header header"
            "chart side"
            "trade side";
          gap: var(--space-6);
          align-items: start;
        }
        @media (max-width: 900px) {
          .panel {
            grid-template-columns: 1fr;
            grid-template-areas: "back" "header" "chart" "trade" "side";
          }
        }
        .back { grid-area: back; align-self: start; padding: var(--space-2) var(--space-3); color: var(--fg-dim); font-size: var(--text-sm); }
        .back:hover { color: var(--fg); }
        header {
          grid-area: header;
          display: flex; gap: var(--space-4);
          padding: var(--space-5);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .emoji { width: 64px; height: 64px; flex-shrink: 0; font-size: 40px; background: var(--surface-2); border-radius: var(--radius-md); display: grid; place-items: center; }
        header h2 { margin: 0; font-size: var(--text-2xl); letter-spacing: -0.02em; }
        header .sym { color: var(--accent); font-family: var(--font-mono); font-weight: 500; font-size: var(--text-lg); }
        header p { margin: var(--space-2) 0 0; color: var(--fg-dim); font-size: var(--text-sm); }
        header .dim { color: var(--muted); }
        .mono { font-family: var(--font-mono); }

        .chart { grid-area: chart; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); }
        .chart svg { width: 100%; height: 140px; display: block; margin-bottom: var(--space-4); }
        .chart-labels { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--fg-dim); flex-wrap: wrap; gap: var(--space-2); }

        .trade { grid-area: trade; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }
        .side-toggle { display: flex; gap: var(--space-1); background: var(--surface-2); padding: var(--space-1); border-radius: var(--radius-md); }
        .side-toggle button { flex: 1; padding: var(--space-2); border-radius: var(--radius-sm); color: var(--fg-dim); font-weight: 600; font-size: var(--text-sm); }
        .side-toggle button[data-on="true"] { background: var(--accent); color: var(--accent-fg); }
        label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); color: var(--fg-dim); }
        label input { padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-2); border: 1px solid var(--border); color: var(--fg); font-family: var(--font-mono); font-size: var(--text-base); }
        label input:focus { border-color: var(--accent); outline: none; }
        .quote { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: var(--space-1) var(--space-4); font-size: var(--text-sm); }
        .quote dt { color: var(--muted); }
        .quote dd { margin: 0; text-align: right; font-family: var(--font-mono); }
        .warn { color: var(--warn); }
        .err { padding: var(--space-3); background: #f43f5e15; border-radius: var(--radius-md); color: var(--loss); font-size: var(--text-sm); }
        .commit { padding: var(--space-4); border-radius: var(--radius-md); background: var(--accent); color: var(--accent-fg); font-weight: 700; font-size: var(--text-base); }
        .commit:hover { background: var(--accent-hover); }
        .commit:disabled { background: var(--surface-2); color: var(--muted); cursor: not-allowed; }
        .risk {
          padding: var(--space-3) var(--space-4); border-radius: var(--radius-md);
          border: 1px solid var(--border); background: var(--surface-2);
          font-size: var(--text-sm); display: flex; flex-direction: column; gap: var(--space-2);
        }
        .risk-danger { border-color: var(--loss); background: #f43f5e15; }
        .risk-warn { border-color: var(--warn); background: #facc1515; }
        .risk-head { display: flex; align-items: center; gap: var(--space-2); }
        .risk-head .risk-dot { font-size: 10px; color: var(--loss); }
        .risk-warn .risk-dot { color: var(--warn); }
        .risk-score { margin-left: auto; font-family: var(--font-mono); color: var(--fg-dim); font-size: var(--text-xs); }
        .risk ul { margin: 0; padding-left: var(--space-4); color: var(--fg-dim); }
        .risk em { font-style: normal; color: var(--loss); text-transform: uppercase; font-size: var(--text-xs); letter-spacing: 0.04em; margin-right: var(--space-2); }
        .risk-warn em { color: var(--warn); }

        .side { grid-area: side; display: flex; flex-direction: column; gap: var(--space-3); }
        .tab-strip { display: flex; gap: var(--space-1); background: var(--surface); padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-full); }
        .tab-strip button { flex: 1; padding: var(--space-2); border-radius: var(--radius-full); color: var(--fg-dim); font-weight: 600; font-size: var(--text-sm); }
        .tab-strip button[data-on="true"] { background: var(--accent-ghost); color: var(--accent); }
      `}</style>
    </div>
  );
}

function sampleCurve(curve: Parameters<typeof spotPrice>[0]): string {
  const N = 64;
  const pts: string[] = [];
  const maxSol = Number(curve.graduationSol);
  const samples: number[] = [];
  for (let i = 0; i <= N; i++) {
    const solIn = BigInt(Math.floor((maxSol * i) / N));
    const virtualPlus = curve.virtualSol + solIn;
    const k = curve.virtualSol * curve.virtualToken;
    const y = k / virtualPlus;
    samples.push(Number(virtualPlus) / Number(y));
  }
  const min = Math.min(...samples), max = Math.max(...samples);
  const logMin = Math.log(min || 1), logMax = Math.log(max || 1);
  const span = logMax - logMin || 1;
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 320;
    const y = 120 - ((Math.log(samples[i] || 1) - logMin) / span) * 110;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}
