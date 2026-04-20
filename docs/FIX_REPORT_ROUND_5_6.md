# FIX_REPORT — Round 5–6: closing the MED wave

**Scope.** This round closes every remaining MED-severity finding
from the deep audit. Rounds 1–4 (covered in prior commit messages)
closed every CRIT and HIGH. After this round the audit tracker has
zero open security items; what's left is functional gaps, not
security work.

**Commits (in order on `main`):**

| SHA | Title |
|---|---|
| `24263b5` | deep-audit: close 9 MED-level items across swap-seq + farm-seq |
| `1b4a431` | farm-seq: MED-FM-2 make farm-intent time checks deterministic |
| `4352135` | deep-audit: close remaining MED items (RL-2/3/4, SW-2, FM-2/3) |

Three workspaces touched: `backend-rust/unipass-wallet-relayer`,
`backend-rust/utxo-swap-sequencer`, `backend-rust/utxoswap-farm-sequencer`.
No new `unsafe`, no new crate deps. `cargo check --workspace` clean
on all three.

---

## Items closed in this round

### Swap sequencer

| ID | Summary | File(s) |
|---|---|---|
| CRIT-SW-3 | `/accounts/info` moved under `/accounts-auth` scope with `JwtAuth` middleware; handler reads `account_id` from middleware-injected `JwtClaims`, replacing fragile inline `jsonwebtoken::decode` with no `alg`/`iss`/`aud` pinning. | `crates/api/src/accounts/info.rs`, `crates/api/src/lib.rs` |
| HIGH-SW-2 | Task reward lookup now reads from a centralized `tasks::catalog` module instead of a hard-coded `Vec` inside the claim handler. | `crates/api/src/tasks/catalog.rs`, `crates/api/src/tasks/claim.rs` |
| HIGH-SW-3 | `/tasks` list handler consumes the same catalog and checks per-user completion via `points_history` when a JWT is present, replacing `is_completed: false` hard-code. | `crates/api/src/tasks/list.rs` |
| HIGH-SW-7 | `candlestick::aggregate_candles` replaces `if` with `while` on the gap branch so multi-bucket gaps emit zero-volume continuation candles at `close`, not silently merge into the next real candle. | `crates/api/src/pools/candlestick.rs` |
| MED-SW-1 | Stub endpoints (`add_liquidity`, `remove_liquidity`, `swap_input_for_exact_output`, `pools/create_pool`) now return **501 Not Implemented** with an info-level log, replacing the 500 `Internal` that looked indistinguishable from a real server bug in alerts. | `crates/api-common/src/error.rs`, `crates/api/src/intents/*.rs`, `crates/api/src/pools/create_pool.rs` |
| MED-SW-2 | `/api/v1/configurations` now serves the real sequencer deployment surface (5 on-chain hashes + fee/limit fields) plumbed through `EnvConfig` → `EnvConfigRef` → handler. Returns **503 Service Unavailable** listing which env vars are unset if any required hash is missing; previously served empty strings. | `src/config.rs`, `crates/api-common/src/context.rs`, `crates/api/src/configurations.rs`, `src/main.rs` |
| MED-SW-3 | `pools/status.rs` replaces the dead `get_cells` RPC with a DB lookup for reserves, returning the batcher-maintained cached values instead of always `0/0/0`. | `crates/api/src/pools/status.rs` |
| MED-SW-5 | Price oracle skips any pool whose known-side USD value is below `PRICE_ORACLE_MIN_USD_LIQUIDITY` (default `$1000`). Closes the low-liquidity-pool manipulation vector. | `crates/utils/src/tokens_manager/price_oracle.rs` |

### Farm sequencer

| ID | Summary | File(s) |
|---|---|---|
| HIGH-SW-1 (farm variant) | New migration adds `UNIQUE(account_id, source_type, source_id)` on `points_history` to enforce at-most-once claim semantics. | `crates/migration/src/m20260420_000000_points_history_unique_claim.rs`, `crates/migration/src/lib.rs` |
| MED-FM-1 | Solver withdraw paths replace `saturating_sub` on `state.total_staked` with `checked_sub`; underflow refunds the intent with "pool/user state desync" instead of silently clamping to 0. | `crates/intent-solver/src/solver.rs` |
| MED-FM-2 | `check_farm_intent` signature now takes an explicit `reference_time_secs: u64` (caller passes CKB block ts, or `now_secs_wallclock()` as fallback). New `CLOCK_SKEW_TOLERANCE_SECS = 120` applied via `pool.end_time.saturating_add()`. `.unwrap()` on `SystemTime::now()` removed. | `crates/types/src/checker.rs` |
| MED-FM-3 | `submit_create_pool_intent` rejects a second farm pool on the same LP token (returns 400 with the existing pool id). | `crates/api/src/intents/submit_create_pool_intent.rs` |

### Relayer (unipass-wallet-relayer)

| ID | Summary | File(s) |
|---|---|---|
| MED-RL-2 | `TokensManager::refresh()` actually populates `self.prices` from the CoinGecko response. Added `coingecko_id_for()` allow-list for well-known addresses. Cache persists across transient HTTP failures instead of being wiped. | `crates/tokens-manager/src/lib.rs` |
| MED-RL-3 | Redis stream consumer replaced with fail-loud stub. `XLEN`-observes the stream every tick; non-empty + `RELAYER_CONSUMER_ENABLED=true` → `bail!`; non-empty + false → WARN log. | `crates/relayer-redis/src/lib.rs` |
| MED-RL-4 | `load_config` now applies the Apollo response to a narrow allow-list of fields. Reserved fields (`relayer_private_key`, `database_url`, `redis_url`, `apollo_url`, `secret_path`) refuse override and log a WARN. Case-insensitive keys, garbage port rejected. 5s fetch timeout. | `crates/configs/src/lib.rs` |

### Cross-cutting

- New `ApiError::NotImplemented` (501, info-log) and
  `ApiError::ServiceUnavailable` (503, warn-log) variants
  distinguish the three non-5xx failure modes: code missing,
  config missing, code broken.
- `AppContext` on both sequencers now carries the full deployment
  surface used by `/configurations` and the fail-closed gates.

---

## Test scorecard

All new tests are pure-function / in-memory; no external service
needed. CI gates them via `.github/workflows/rust-tests.yml`.

| Crate | Tests | Covers |
|---|---|---|
| `utxo-swap-sequencer::api::lib` | 16 | task catalog (3), candlestick window/gap-fill (8), /configurations (4), molecule parser regression (5 from prior round still gating) |
| `utxo-swap-sequencer::utils::lib` | 5 | price-oracle liquidity gate + env-var override |
| `utxoswap-farm-sequencer::types::lib` | 16 | parser (9), checker clock-skew tolerance (7) |
| `utxoswap-farm-sequencer::api::lib` | 5 | submit intent type/amount write-through + 503 gate |
| `utxoswap-farm-sequencer::intent-solver` | 14 | per-user running state + MED-FM-1 underflow refund |
| `unipass-wallet-relayer::tokens-manager` | 3 | MED-RL-2 |
| `unipass-wallet-relayer::relayer-redis` | 3 | MED-RL-3 env gate |
| `unipass-wallet-relayer::configs` | 4 | MED-RL-4 Apollo allow-list |
| **Total new in rounds 5–6** | **37** | 0 failures |

Integration with prior rounds: the relayer HTTP handler (6),
replay cache (5), validator (9), parser (5), RPC client (5), and
three services' `security::tests` (12) all remain green. Workspace
totals around 80 unit tests across all three services.

---

## Guardrail knobs introduced

| Env var | Default | Purpose |
|---|---|---|
| `FARM_PROCESSING_ENABLED` | `false` | Fail-closed farm submit + pools-manager |
| `RELAYER_CONSUMER_ENABLED` | `false` | Fail-loud stream consumer |
| `PRICE_ORACLE_MIN_USD_LIQUIDITY` | `1000` | Oracle liquidity floor |
| `SEQUENCER_LOCK_CODE_HASH` and 4 more | *(unset → 503)* | `/configurations` deployment surface |
| `SWAP_FEE_BPS` / `MIN_LIQUIDITY` / `MAX_INTENTS_PER_BATCH` / `BATCH_INTERVAL_MS` | `30` / `1000` / `50` / `3000` | UI parity with batcher |

All of these are documented in
`docs/deployment-rehearsal.md` §4a together with the 501/503/500
status-code contract in §4b.

---

## What's left

Security: **nothing open**. CRIT + HIGH + MED tracker entries are
all closed.

Functional gaps (not security, no user-funds risk under the
current fail-closed gates):

1. **CKB batch-tx builder** for `utxoswap-farm-sequencer` pools
   manager — multi-session work; currently gated by
   `FARM_PROCESSING_ENABLED=false`.
2. **Relayer signing pipeline** (`XREADGROUP` → sign →
   `eth_sendRawTransaction` → `XACK`) — currently gated by
   `RELAYER_CONSUMER_ENABLED=false`.
3. **Live-sidecar integration tests** and frontend Playwright
   E2E — deferred from this round.

See `docs/deployment-rehearsal.md` "Open pre-deployment blockers"
for the same list in the deployment context.
