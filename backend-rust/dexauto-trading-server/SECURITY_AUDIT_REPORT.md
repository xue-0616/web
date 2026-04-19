# Security & Logic Audit Report — dexauto-trading-server (Rust)

**Date**: 2026-04-15
**Scope**: All original/untouched source files in `backend-rust/dexauto-trading-server/`
**Total Files Audited**: 35 Rust source files across 7 crates

---

## Executive Summary

**Overall Risk Rating: 🔴 CRITICAL**

The codebase has several critical security vulnerabilities centered around **complete lack of authentication/authorization**, **permissive CORS**, and **no rate limiting**. The API is fully open — any internet user can submit swaps, cancel any order, and enumerate all operator keys. The trading logic (Jupiter integration, AMM math, Jito bundling) is generally sound but has notable gaps in input validation and error handling.

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 6 |
| 🟠 HIGH | 10 |
| 🟡 MEDIUM | 19 |
| 🟢 LOW | 9 |

---

## 1. API Layer — `crates/api/src/`

### 1.1 swap.rs — POST /api/v1/trading/swap

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 1 | 🔴 CRITICAL | **No Authentication** | Endpoint has zero auth. Anyone can submit swap transactions spending the platform's SOL/tokens. No JWT, API key, or any form of auth. |
| 2 | 🟠 HIGH | **No input validation on amount_specified** | `amount_specified` is `u64` (prevents negatives) but **zero amount is accepted**. A 0-amount swap wastes priority fees, creates junk DB records, and sends pointless Jito bundles. |
| 3 | 🟠 HIGH | **No slippage_bps upper bound** | `slippage_bps: u16` accepts values up to 65535. No cap at a sane maximum (e.g. 5000 = 50%). A malicious request with `slippage_bps: 10000` (100%) would accept any output amount. |
| 4 | 🟠 HIGH | **u64→i64 cast overflow** | `amount_specified as i64` and `bribery_amount as i64` wrap to negative if input ≥ 2^63. DB stores corrupt negative values. Also affects `max_priority_fee`, `other_amount_threshold`, `slippage_bps as i16`, `fee_rate_bps as i16`. |
| 5 | 🟡 MEDIUM | **user_id hardcoded to order_id** | Line: `user_id: sea_orm::Set(req.order_id.clone())` — TODO says "extract from JWT" but without auth, there's no user identity at all. |
| 6 | 🟡 MEDIUM | **No duplicate order_id check** | Multiple swaps with the same `order_id` can be inserted. No unique constraint enforced at DB insert level. |
| 7 | 🟡 MEDIUM | **Channel backpressure blocks HTTP** | If the 256-capacity mpsc channel fills, `sender.send(job).await` blocks the HTTP handler, stalling all subsequent requests. |
| 8 | 🟢 LOW | **10% price impact threshold too high** | Production trading should reject at much lower thresholds (1-3%). |

### 1.2 cancel_tx.rs — POST /api/v1/trading/cancel

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 9 | 🔴 CRITICAL | **No Authentication / No ownership check** | Any user can cancel any order by guessing/knowing the `order_id`. No check that the requester owns the order. |
| 10 | 🟠 HIGH | **Cancel doesn't stop in-flight tx** | Only updates DB status to `Cancelled`. If the tx was already submitted to Jito/RPC, it will still execute on-chain. Cancel is cosmetic only. |
| 11 | 🟡 MEDIUM | **No status guard** | Can "cancel" already-confirmed or already-failed transactions. Should only allow cancelling `Pending` status. |

### 1.3 op_key/create_op_key.rs — POST /api/v1/op-key/create

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 12 | 🔴 CRITICAL | **No Authentication** | Anyone can request operator key creation. |
| 13 | 🟠 HIGH | **Stub implementation** | Handler returns `{"status": "created"}` without actually creating anything. Steps 1-5 are commented pseudocode. |

### 1.4 op_key/get_op_keys.rs — GET /api/v1/op-key/list

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 14 | 🔴 CRITICAL | **No Authentication / IDOR** | Anyone can list any user's operator keys by passing `?userId=<target>`. Insecure Direct Object Reference. |
| 15 | 🟡 MEDIUM | **Empty userId fallback** | Missing `userId` param defaults to empty string query, potentially returning unintended records. |

### 1.5 lib.rs (Route Configuration)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 16 | 🔴 CRITICAL | **No auth middleware on any route** | `configure_routes` registers all endpoints with zero middleware guards. Every endpoint is publicly accessible. |

---

## 2. API Common — `crates/api-common/src/`

### 2.1 context.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 17 | 🟠 HIGH | **Secrets in plain-text struct** | `AppContext` holds `tx_submitter_private_key` and `jupiter_api_key` as `String`. If the context is ever accidentally logged, serialized, or exposed via a debug endpoint, keys leak. Should use `secrecy::Secret<String>`. |
| 18 | 🟡 MEDIUM | **No auth infrastructure** | No auth middleware, no JWT validator, no API key checker defined anywhere in api-common. Auth is completely absent from the architecture. |

### 2.2 operator_key.rs (SolanaSwapRequest)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 19 | 🟡 MEDIUM | **No validation constraints** | No `#[validate]` attributes. `slippage_bps` unbounded, `amount_specified` can be 0, `trading_account_pda` not validated as valid base58 pubkey. |
| 20 | 🟡 MEDIUM | **CreateOpKeyRequest.max_priority_fee is i64** | Allows negative priority fee values. |

---

## 3. Entity Layer — `crates/entity/src/`

### 3.1 trading_transactions.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 21 | 🟡 MEDIUM | **Signed types for unsigned values** | `amount_specified: i64`, `bribery_amount: i64`, `max_priority_fee: i64` should all be unsigned. Combined with the u64→i64 cast in swap.rs (#4), large values become negative in DB. |
| 22 | 🟡 MEDIUM | **No unique constraint on order_id** | Entity definition has no unique index on `order_id`. |
| 23 | 🟢 LOW | **Derive Serialize on Model** | The model derives `Serialize` which could accidentally expose all fields (including internal IDs) in API responses. |

### 3.2 operator_keys.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 24 | 🟡 MEDIUM | **encrypted_private_key is Serialize** | `encrypted_private_key: Vec<u8>` is included in the Serialize derive. If the model is ever serialized to JSON (API response, log), the encrypted key blob is exposed. Should be `#[serde(skip_serializing)]`. |
| 25 | 🟢 LOW | **max_priority_fee is i64** | Can store negative values. |

### 3.3 trigger_transactions.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 26 | 🟢 LOW | **f64 for trigger_price_usd** | Floating point for price. Acceptable for trigger thresholds but not for precise financial calculations. |

---

## 4. Jupiter Swap Builder — `crates/tx-builder/src/jupiter/swap.rs`

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 27 | 🟠 HIGH | **No HTTP status check** | `get_quote()` and `build_swap_tx()` call `.send().await?.json().await?` without checking HTTP status. A 400/500 response produces a confusing deserialization error instead of a clear error message. Should call `.error_for_status()?` before `.json()`. |
| 28 | 🟡 MEDIUM | **No request timeout** | HTTP client has no timeout. A stalled Jupiter API call blocks forever, tying up the handler indefinitely. |
| 29 | 🟡 MEDIUM | **No retry logic** | Jupiter API calls have zero retries for transient 429/502/503 errors. |
| 30 | 🟡 MEDIUM | **Zero amount accepted** | If `amount_specified` is 0, Jupiter returns a valid quote with 0 output. The system proceeds to build and submit a zero-value transaction. |
| 31 | 🟢 LOW | **f64 in check_entry_deviation** | Uses f64 for financial comparison. Acceptable for deviation percentage but not ideal for exact amount comparisons. |

---

## 5. Raydium AMM — `crates/tx-builder/src/raydium_amm/`

### 5.1 core/math.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 32 | ✅ OK | **Overflow protection** | Uses u128 intermediates for all arithmetic. Division-by-zero returns 0 (exact_in) or u64::MAX (exact_out). |
| 33 | 🟢 LOW | **u64::MAX sentinel** | `calculate_swap_exact_out` returns `u64::MAX` when `amount_out >= pool_out`. Callers must check for this — if not, they'd build a tx requesting u64::MAX input tokens. |

### 5.2 swap.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 34 | 🟡 MEDIUM | **Slippage truncation** | `amount_out * (10000 - slippage_bps as u64) / 10000` — integer division always rounds down, giving slightly less slippage protection than specified. |
| 35 | ✅ OK | **Instruction data layout** | Correct: discriminator(1) + amount_in(8) + min_out(8) = 17 bytes. |

### 5.3 common/rpc.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 36 | 🟠 HIGH | **Returns placeholder data** | `fetch_pool_state()` parses the account but returns hardcoded zeros for reserves, empty strings for mints/vaults. **Any Raydium swap using this would get 0 output or fail.** This is effectively broken. |
| 37 | 🟡 MEDIUM | **Silent error swallowing** | Uses `unwrap_or("")` and `unwrap_or_default()` instead of propagating errors. |

### 5.4 utils.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 38 | 🟡 MEDIUM | **Panic on short data** | `read_u64_le()` does `&data[offset..offset + 8]` with no bounds check. Will panic with index-out-of-bounds if data is shorter than `offset + 8`. |

---

## 6. CPIs — `crates/cpis/src/trading_account/mod.rs`

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 39 | 🟢 LOW | **Hardcoded Anchor discriminator** | `[0x5f, 0x3e, 0x2c, 0x1b, 0x0a, 0x09, 0x08, 0x07]` — should be derived from Anchor IDL hash. If program updates, this silently breaks. |
| 40 | 🟢 LOW | **trading_account_pda param unused** | The function accepts `trading_account_pda` but never uses it. Only builds instruction data, not the full instruction with accounts. |

---

## 7. Transaction Submitter — `crates/utils/src/tx_submitter/`

### 7.1 submitter.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 41 | 🟠 HIGH | **Private key not zeroized** | `fee_payer_keypair: Option<Vec<u8>>` stores raw private key bytes. Never zeroed on drop. Memory could be swapped to disk or read from core dump. Should use `zeroize::Zeroizing<Vec<u8>>`. |
| 42 | 🟡 MEDIUM | **Inconsistent tip account in log vs actual** | `random_tip_account()` in debug log (line ~165) and `build_tip_tx()` call it at different times, getting different random accounts. Log shows wrong tip recipient. |
| 43 | 🟡 MEDIUM | **skipPreflight on RPC fallback** | `submit_via_rpc_endpoint` uses `skipPreflight: true`. Errors won't be caught before on-chain execution. Combined with no-auth, malicious txs go straight to validators. |
| 44 | ✅ GOOD | **Pre-flight CU simulation** | Excellent defense against CU-drain TransferHook attacks. Rejects txs consuming >1M CU before paying Jito tip. |
| 45 | ✅ GOOD | **Tiered fallback routing** | Jito → Staked RPC (SWQoS) → Standard RPC. Well-designed degradation path. |

### 7.2 runner.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 46 | 🟠 HIGH | **Retry doesn't re-submit** | When `should_retry()` is true, it sleeps 5s but **never re-submits the transaction**. The pending tx is silently dropped after the sleep. The retry mechanism is broken. |
| 47 | 🟡 MEDIUM | **No dead-letter queue** | Failed txs after max retries are logged and dropped with no recovery mechanism. No DB status update to `Failed`. |

### 7.3 pending_transaction.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 48 | ✅ OK | **Reasonable structure** | max_retries=3 default is fine. |

---

## 8. Jito Client — `crates/utils/src/jito_client.rs`

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 49 | 🟢 LOW | **Weak randomness for tip account** | Uses `subsec_nanos()` for entropy — predictable. Not security-critical for tip account selection but should use `rand::thread_rng()`. |
| 50 | ✅ GOOD | **Bundle size validation** | Validates 1-5 transaction limit. |
| 51 | ✅ GOOD | **Tip floor/ceiling bounds** | 10,000 lamport floor, 10,000,000 ceiling. Prevents both too-low (rejected by Jito) and too-high (cost overrun) tips. |
| 52 | ✅ GOOD | **Signal-strength-aware tipping** | Uses consensus vote count to select P50 vs P75 tip. Cost-efficient. |

---

## 9. Data Center Client — `crates/utils/src/data_center_client.rs`

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 53 | 🟠 HIGH | **Not implemented** | `connect()` returns error immediately. Stub only. |

---

## 10. Op Key Manager — `crates/utils/src/op_key_manager.rs`

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 54 | 🟠 HIGH | **Not implemented** | Both `create_key()` and `decrypt_key()` return errors. No actual key management works. |
| 55 | 🟢 LOW | **Good design intent** | AWS KMS encryption approach is correct. Just not built yet. |

---

## 11. main.rs and config.rs

### 11.1 main.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 56 | 🔴 CRITICAL | **Cors::permissive()** | Allows ALL origins, ALL methods, ALL headers. Any malicious website can make authenticated requests to this API via browser. Must restrict to known frontend domains. |
| 57 | 🔴 CRITICAL | **No rate limiting** | No rate limiting middleware. An attacker can flood the swap endpoint, filling the channel and DB with junk, or exhausting the fee payer's SOL via bribery tips. |
| 58 | 🟡 MEDIUM | **Binds 0.0.0.0** | Listens on all network interfaces. Should default to 127.0.0.1 for non-public deployments, or be configurable. |
| 59 | 🟡 MEDIUM | **No graceful shutdown** | No SIGTERM/SIGINT handler. When the server stops, in-flight transactions in the mpsc channel are silently dropped. |

### 11.2 config.rs

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 60 | 🟡 MEDIUM | **Secrets in Debug derive** | `EnvConfig` derives `Debug`. Logging `{:?}` on the config struct prints `tx_submitter_private_key`, `jupiter_api_key`, etc. to logs. |
| 61 | 🟢 LOW | **Silent empty defaults** | Most config values default to empty string via `#[serde(default)]`. Partial configuration silently fails at runtime instead of startup. |

---

## 12. Additional Files

### fee_estimator.rs
✅ **OK** — Well-structured with parallel fetches, timeouts (3s on Helius), and reasonable fallback defaults.

### next_block_client.rs
✅ **OK** — Minimal but correct. Uses Bearer auth for NextBlock API.

### shredstream_client.rs
✅ **OK** — Well-documented architecture with auto-reconnect. Parsing is placeholder (requires jito_protos dep) but design is sound.

---

## Priority Fix Recommendations

### Must Fix Before Production (CRITICAL)

1. **Add authentication middleware** — Implement JWT or API key auth on all `/api/v1/*` routes
2. **Restrict CORS** — Replace `Cors::permissive()` with explicit origin whitelist
3. **Add rate limiting** — Use `actix-governor` or similar to rate-limit all endpoints
4. **Add ownership checks** — Cancel and list endpoints must verify user owns the resource

### Should Fix (HIGH)

5. **Add input validation** — Reject `amount_specified == 0`, cap `slippage_bps` at sane maximum (e.g. 5000), validate `trading_account_pda` as valid base58
6. **Fix u64→i64 overflow** — Use `TryFrom` or validate amounts < i64::MAX before casting
7. **Fix retry logic in runner.rs** — Actually re-submit failed transactions instead of sleeping and dropping
8. **Add HTTP timeouts** — Set 10-30s timeouts on all reqwest clients
9. **Check HTTP response status** — Call `.error_for_status()?` before `.json()` on Jupiter API calls
10. **Zeroize private keys** — Use `zeroize::Zeroizing<Vec<u8>>` for fee_payer_keypair
11. **Complete Raydium RPC** — `fetch_pool_state` returns zeros; any Raydium swap is broken

### Nice to Have (MEDIUM/LOW)

12. Fix inconsistent tip account logging
13. Add dead-letter queue for failed transactions
14. Add graceful shutdown with channel drain
15. Redact secrets from Debug derive
16. Add `#[serde(skip_serializing)]` on `encrypted_private_key`
