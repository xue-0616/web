/**
 * Honeypot detection — pre-trade checks that flag tokens the user should
 * probably not touch. The checks mirror what Phantom, Birdeye and
 * DexScreener run client-side before letting the "Buy" button light up.
 *
 * All checks here are PURE: we take a snapshot of on-chain state and
 * return a verdict. A real deployment fills `TokenSnapshot` by fanning
 * out a few RPC calls (see `fetchSnapshot` in production code):
 *
 *   - `getMint`          → mintAuthority, freezeAuthority, decimals, supply
 *   - `getAccount`       → LP token-account to check burn status
 *   - `getProgramAccounts` on TOKEN_2022 → transfer-hook / transfer-fee extensions
 *
 * The scoring is deliberately conservative: a single DANGER signal is
 * enough to block the buy button. We prefer false-positives (annoying)
 * over false-negatives (users losing money).
 */

export type Severity = "info" | "warn" | "danger";

export interface HoneypotSignal {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface TokenSnapshot {
  /** base58 mint address — purely informational, used in messages. */
  mint: string;
  /** `true` if `mintAuthority` is still set (tokens can be minted forever). */
  mintAuthorityActive: boolean;
  /** `true` if `freezeAuthority` is still set (can freeze any holder's account). */
  freezeAuthorityActive: boolean;
  /** Percentage (0–100) of the LP supply that has been permanently burned. */
  lpBurnedPct: number;
  /** Total holders. Undefined means we couldn't query the indexer. */
  holderCount?: number;
  /** Top-holder concentration: fraction 0–1 owned by the single largest holder
   *  (excluding the pool itself). */
  top1Pct: number;
  /** TOKEN_2022 extensions that exist on the mint. Any of these need a
   *  closer look because they can intercept transfers. */
  tokenExtensions: string[];
  /** Recorded creation age. Tokens younger than a few hours are much more
   *  likely to rug. */
  ageSeconds: number;
  /** `true` if the pool is a CPMM/constant-product; `false` if it's an
   *  oracle-priced or permissioned pool we can't sim. */
  poolIsStandard: boolean;
}

export interface HoneypotVerdict {
  /** Blocks the UI buy button when true. */
  block: boolean;
  /** 0 = pristine, 100 = definitely unsafe. */
  riskScore: number;
  signals: HoneypotSignal[];
}

// ─── individual checks (each returns 0 or 1 signal) ─────────────────────────

function mintAuthorityCheck(s: TokenSnapshot): HoneypotSignal | null {
  if (!s.mintAuthorityActive) return null;
  return {
    code: "mint-authority-open",
    severity: "danger",
    title: "Mint authority still active",
    detail:
      "The deployer can mint new tokens at will, diluting your position. Look for tokens where mintAuthority is revoked (set to null).",
  };
}

function freezeAuthorityCheck(s: TokenSnapshot): HoneypotSignal | null {
  if (!s.freezeAuthorityActive) return null;
  return {
    code: "freeze-authority-open",
    severity: "danger",
    title: "Freeze authority still active",
    detail:
      "The deployer can freeze your account and lock out sells — the classic soft-rug. Safer mints revoke freezeAuthority.",
  };
}

function lpBurnCheck(s: TokenSnapshot): HoneypotSignal | null {
  if (s.lpBurnedPct >= 95) return null;
  if (s.lpBurnedPct >= 50) {
    return {
      code: "lp-partially-burned",
      severity: "warn",
      title: `Only ${s.lpBurnedPct.toFixed(0)}% of LP is burned`,
      detail:
        "The deployer still controls enough of the pool to pull liquidity. A safer token has ≥ 95% burned or locked.",
    };
  }
  return {
    code: "lp-not-burned",
    severity: "danger",
    title: "LP is not meaningfully burned",
    detail: "The deployer can pull the pool at any time. Avoid unless you know the team.",
  };
}

function top1Check(s: TokenSnapshot): HoneypotSignal | null {
  if (s.top1Pct <= 0.10) return null;
  if (s.top1Pct <= 0.25) {
    return {
      code: "top1-high",
      severity: "warn",
      title: `Top holder owns ${(s.top1Pct * 100).toFixed(1)}%`,
      detail: "One address can swing the price. Fine for new tokens but watch for dumps.",
    };
  }
  return {
    code: "top1-critical",
    severity: "danger",
    title: `Top holder owns ${(s.top1Pct * 100).toFixed(1)}%`,
    detail: "A single wallet can rug the market. Steer clear.",
  };
}

function ageCheck(s: TokenSnapshot): HoneypotSignal | null {
  if (s.ageSeconds >= 3600 * 6) return null; // ≥ 6h old is fine
  if (s.ageSeconds >= 3600) {
    return {
      code: "age-new",
      severity: "warn",
      title: "Token is fresh",
      detail: "Less than 6 hours since launch. Rug risk and volatility are highest in the first hours.",
    };
  }
  return {
    code: "age-fresh",
    severity: "warn",
    title: "Token launched < 1h ago",
    detail: "Extremely early — most launches rug within the first hour. Size accordingly.",
  };
}

function holdersCheck(s: TokenSnapshot): HoneypotSignal | null {
  if (s.holderCount === undefined) return null;
  if (s.holderCount >= 100) return null;
  return {
    code: "holders-thin",
    severity: s.holderCount < 20 ? "danger" : "warn",
    title: `Only ${s.holderCount} holders`,
    detail: "Low holder count → thin exit liquidity. Any meaningful sell will tank the price.",
  };
}

function extensionsCheck(s: TokenSnapshot): HoneypotSignal | null {
  const dangerous = s.tokenExtensions.filter((e) =>
    ["transfer-hook", "permanent-delegate", "non-transferable"].includes(e),
  );
  if (dangerous.length === 0) return null;
  return {
    code: "token2022-dangerous",
    severity: "danger",
    title: `Dangerous TOKEN-2022 extension${dangerous.length > 1 ? "s" : ""}: ${dangerous.join(", ")}`,
    detail:
      "These extensions let the mint intercept every transfer. A transfer-hook is the most common honeypot primitive.",
  };
}

function poolCheck(s: TokenSnapshot): HoneypotSignal | null {
  if (s.poolIsStandard) return null;
  return {
    code: "pool-nonstandard",
    severity: "warn",
    title: "Non-standard pool",
    detail: "We couldn't simulate a round-trip sell — maybe an oracle-priced or permissioned pool. Proceed manually.",
  };
}

const CHECKS: Array<(s: TokenSnapshot) => HoneypotSignal | null> = [
  mintAuthorityCheck,
  freezeAuthorityCheck,
  lpBurnCheck,
  top1Check,
  ageCheck,
  holdersCheck,
  extensionsCheck,
  poolCheck,
];

// ─── aggregate ──────────────────────────────────────────────────────────────

/**
 * Weight each severity and clamp to 0..100. Any single `danger` signal
 * makes `block=true` regardless of score; the score still matters for
 * the UI gauge.
 */
export function evaluateHoneypot(s: TokenSnapshot): HoneypotVerdict {
  const signals: HoneypotSignal[] = [];
  for (const check of CHECKS) {
    const sig = check(s);
    if (sig) signals.push(sig);
  }

  let score = 0;
  for (const sig of signals) {
    if (sig.severity === "danger") score += 40;
    else if (sig.severity === "warn") score += 15;
    else score += 2;
  }
  if (score > 100) score = 100;

  const block = signals.some((sig) => sig.severity === "danger");
  return { block, riskScore: score, signals };
}

/**
 * Demo-only: synthesize a plausible snapshot from a token's name/mint.
 * Production code REPLACES this with an RPC fan-out (see module docstring).
 *
 * The algorithm is deterministic per-mint: tokens whose name contains
 * "rug" deliberately trip several danger flags so the UI can show the
 * blocked state without needing network mocking.
 */
export function synthesizeSnapshot(t: {
  mint: string;
  name: string;
  symbol: string;
  createdAt: number;
}): TokenSnapshot {
  const ageSeconds = Math.max(0, Math.floor((Date.now() - t.createdAt) / 1000));
  const lower = `${t.name} ${t.symbol}`.toLowerCase();
  const suspicious = /rug|scam|test|honey/.test(lower);
  // Cheap deterministic PRNG seeded by mint so the numbers stay stable between renders.
  let h = 0;
  for (const c of t.mint) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  return {
    mint: t.mint,
    mintAuthorityActive: suspicious,
    freezeAuthorityActive: suspicious && rand() > 0.4,
    lpBurnedPct: suspicious ? rand() * 40 : 95 + rand() * 5,
    holderCount: suspicious ? Math.floor(rand() * 40) + 5 : Math.floor(rand() * 5000) + 200,
    top1Pct: suspicious ? 0.2 + rand() * 0.5 : rand() * 0.08,
    tokenExtensions: suspicious && rand() > 0.6 ? ["transfer-hook"] : [],
    ageSeconds,
    poolIsStandard: true,
  };
}

/** Convenience: produce a one-line summary for a toast. */
export function summarize(v: HoneypotVerdict): string {
  if (v.signals.length === 0) return "No honeypot signals detected.";
  const d = v.signals.filter((s) => s.severity === "danger").length;
  const w = v.signals.filter((s) => s.severity === "warn").length;
  return `${d} danger, ${w} warning — risk ${v.riskScore}/100`;
}
