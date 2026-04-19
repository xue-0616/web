# Infrastructure Deployment Guide

This document covers latency-sensitive infrastructure choices that **cannot** be
expressed purely in code — they are deployment decisions that determine whether
the strategy can compete on Solana in 2026.

---

## 1. RPC / gRPC Data Source Selection

The system supports two Yellowstone-protocol-compatible providers (you can
point at either — they are mutually exclusive at runtime):

| Provider | Env Vars | Latency | Cost | When to use |
|----------|----------|---------|------|-------------|
| **Helius LaserStream** (recommended) | `LASERSTREAM_GRPC_ENDPOINT`, `LASERSTREAM_GRPC_TOKEN` | **~20-40ms p99** | $400-$6000/mo | Default for all production. 2026 benchmark shows lower p99 latency than self-hosted Yellowstone. Comes with 24h historical replay. |
| Self-hosted Yellowstone | `GEYSER_GRPC_ENDPOINT`, `GEYSER_GRPC_TOKEN` | depends on co-location | hardware only | Only if you're running a bare-metal validator with ≤1ms to the firedancer/agave client AND want Frankfurt/NY co-location on your terms. |

The code picks LaserStream if both are set (Helius' 2026 infrastructure has
consistently shown better p99 than self-hosted Yellowstone on shared hardware).

### ShredStream Sidecar (for pre-confirmation trading)

ShredStream provides **200-500ms earlier** signals than confirmed gRPC.
Set `SHREDSTREAM_GRPC_ENDPOINT=http://127.0.0.1:9999` after running the
jito-shredstream-proxy sidecar:

```bash
docker run -d \
  --name jito-shredstream-proxy \
  --rm \
  --env RUST_LOG=info \
  --env BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf \
  --env AUTH_KEYPAIR=/keys/jito.json \
  --env DESIRED_REGIONS=amsterdam,ny,tokyo \
  --env SRC_BIND_PORT=20000 \
  --env DEST_IP_PORTS=127.0.0.1:9999 \
  -v $(pwd)/keys:/keys \
  --net host \
  jitolabs/jito-shredstream-proxy
```

---

## 2. Firedancer Adaptation (2026)

Firedancer (Jump Crypto's independently developed Solana validator client) is
rolling out through 2026 with up to **1M+ TPS**. Our code does two things to
stay future-compatible:

1. **Cluster client probe on startup** (`GeyserSubscriberService.probeClusterClientVersion`)
   — detects Agave vs Firedancer by parsing `getVersion.solana-core` string.
   Exposes `this.clusterClient` for future protocol-specific branches.

2. **TokenBalance owner authority** (`dex-swap-parser.ts`) — only trusts the
   `bal.owner` field from Yellowstone TokenBalance messages, which is populated
   consistently by both Agave and Firedancer. No longer falls back to
   `accountKeys[accountIndex]`.

### Things to watch when Firedancer goes live

- **Shred broadcast timing** may differ — ShredStream proxy still works, but
  re-benchmark your end-to-end latency after each Firedancer release.
- **Compute budget instruction encoding** could change. The trading server
  (Rust side — `backend-rust/dexauto-trading-server`) handles this; if tips
  start getting silently dropped, inspect that path first.
- **New slot metadata fields** in Yellowstone gRPC. If added, use them to
  replace the `Date.now()` fallback in `dex-swap-parser.ts` blockTime logic.

Run the RPC version probe in production to confirm cluster composition:

```bash
curl -s $SOLANA_RPC_URL -X POST -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}'
```

---

## 3. Jito Bundle / Tip Strategy (Trading Server Side)

This is handled in `backend-rust/dexauto-trading-server`. The Node side simply
enqueues buy/sell orders; the Rust engine is responsible for Jito bundle
packaging. **This doc captures the design choices the Rust engine should honor.**

### Required behaviors

1. **Always-bundle**: when `isAntiMev=true` (see `tradingSetting.isMevEnabled`),
   the buy MUST be submitted as a Jito bundle (never plain TPU) to prevent
   sandwich attacks.

2. **Dynamic tip sizing** — the tip should scale with expected profit, not be
   a fixed priority fee:
   ```
   tip_lamports = max(
       min_tip,                          // floor, e.g. 10_000 lamports
       expected_profit_sol × 0.1 × 1e9,  // 10% of expected profit
       competitive_quote,                // from Jito tipstream
   )
   ```
   Solana 2025/2026 top HFT bots set tips to **~10% of expected edge** and
   poll Jito's `getTipAccounts` tip-floor endpoint in real time.

3. **Bundle composition for Circuit Breaker** — when the realtime circuit
   breaker fires with tranches, each tranche MUST go as its own bundle so
   the timing randomization (500-2000ms between tranches) is preserved at
   block-inclusion time. Batching them into one bundle collapses the
   randomization.

4. **Failed bundle retry logic** —
   - If a buy bundle fails due to slippage → **do not retry automatically**
     (price already moved, you'd buy a worse price).
   - If a sell bundle fails → **retry up to 3 times with escalating tips**
     (the position must exit).

5. **Region selection** — configure `DESIRED_REGIONS` in the ShredStream
   sidecar AND in Jito block engine calls to the same region where the server
   is co-located. Cross-region adds 30-80ms.

### 3b. Post-trade slippage verification

Every confirmed swap MUST be reconciled against the quote used at decision time:

```
actual_slippage_bps = |(actual_tokens_received - quoted_tokens) / quoted_tokens| × 10_000
```

If `actual_slippage_bps > 2 × configured_slippage_bps`:
- **Log at ERROR level** with `expected`, `actual`, `pool`, `signature`
- Emit `swap_slippage_exceeded_total{strategy_id}` counter for Grafana alerting
- For **buys**: trigger an immediate `evaluatePosition()` check — if entry
  deviation from smart money is now beyond threshold, force early exit
- For **sells**: no retry (already sold), but do emit an alert

### 3c. Failure-mode retry policy

| Event | Retry? | Strategy |
|-------|--------|----------|
| Buy bundle: slippage exceeded | ❌ No | price already moved, don't chase |
| Buy bundle: tip too low | ✅ Yes, once | escalate tip by 2×, retry immediately |
| Buy bundle: blockhash expired | ✅ Yes, once | new blockhash, same tip |
| Sell bundle: any failure | ✅ Yes, up to 3× | escalate tip each retry, position MUST exit |
| Circuit Breaker tranche fails | ✅ Yes, once | re-queue subsequent tranches too |

### Observability signals the Rust server MUST emit

- `jito_bundle_landed_total{region}` counter
- `jito_bundle_dropped_total{reason}` counter
- `jito_tip_lamports` histogram
- `swap_slippage_bps` histogram

These feed the KPI Dashboard — any regression becomes visible within one
evaluation window.

---

## 4. Wallet Rotation

Each `autoTrade` can specify a `subWallets` array with sibling
`{walletId, walletAddress}` entries. The executor picks one at random per
trade via `pickWalletForTrade()` to defeat MEV bots that fingerprint
(source → follower) wallet pairs. Configure at least 3-5 sub-wallets in
production.

```json
{
  "index": 0,
  "walletId": "primary-uuid",
  "walletAddress": "Abc1...",
  "subWallets": [
    { "walletId": "sub1-uuid", "walletAddress": "Def2..." },
    { "walletId": "sub2-uuid", "walletAddress": "Ghi3..." },
    { "walletId": "sub3-uuid", "walletAddress": "Jkl4..." }
  ],
  "solNormalizedAmount": "0.5",
  "isRepeat": false
}
```

---

## 5. Social Signal Providers

`SocialSignalService` pulls from optional off-chain data providers. Set at
least one env var to enable the Layer-10 CopyTradeFilter check:

| Provider | Env Vars | Purpose |
|----------|----------|---------|
| Twitter (Apify / Nitter proxy) | `TWITTER_STREAM_API_URL`, `TWITTER_STREAM_API_KEY` | Tweet volume, KOL influence, coordinated-campaign detection |
| LunarCrush v2 | `LUNARCRUSH_API_KEY` | Aggregated social volume + sentiment |
| Self-hosted TG scraper | `TELEGRAM_MONITOR_URL` | TG group chatter + coordinated-shilling flag |

The service degrades to neutral (returns `null`) when no provider is configured,
so the trading pipeline keeps working without social signal data.

---

## 6. Production Risk Controls

### Daily loss circuit breaker
Configured in `DailyLossCircuitBreakerService`:
- `maxDailyLossSol`: 2.0 SOL default
- `maxDailyLossRatio`: 0.20 (20% of daily budget)
Both conditions active (OR semantics). Resets at UTC midnight.

Manual override (operator-only endpoint — NOT exposed to users):
```
POST /admin/risk/resume
{ "userId": "...", "reason": "..." }
```

### Per-token exposure cap
`FundAllocatorService.maxSingleTokenExposure = 0.1` (10% of total budget).
Aligned with 2026 whale-tracking studies — top-PnL wallets rarely exceed 10%
single-token concentration.

### Position increases
`CopyTradeFilter.maxPositionIncreases = 3`. Averaging into a losing position
beyond 3× is a retail anti-pattern that whale wallets explicitly avoid.

---

## Checklist for First Production Deploy

- [ ] LaserStream configured with pinned region
- [ ] ShredStream sidecar running and health-checked
- [ ] `SOLANA_RPC_URL` set so `probeClusterClientVersion` logs the right client
- [ ] At least one social signal provider configured
- [ ] `subWallets` populated with ≥3 addresses per autoTrade
- [ ] `DailyLossCircuitBreakerService` limits tuned to account size
- [ ] KPI Dashboard metrics scraped into Grafana
- [ ] 2-week small-balance (<1 SOL) shadow run before scaling up
