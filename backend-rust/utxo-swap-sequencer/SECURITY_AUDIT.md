# Security Audit Report: utxo-swap-sequencer

**Date:** 2026-04-15  
**Scope:** Full Rust codebase security review  
**Project:** UTXOSwap Sequencer — DEX order sequencer for CKB (Nervos) blockchain  

---

## Executive Summary

The utxo-swap-sequencer is a backend service that accepts user swap/liquidity intents, batches them, and builds CKB transactions. The project is partially implemented (several API handlers return "Not yet implemented"). The audit covers **implemented code** for correctness, security, and potential fund-loss scenarios.

**Critical findings: 4 | High: 7 | Medium: 8 | Low: 5**

---

## CRITICAL Severity

### C-1: Hardcoded CoinMarketCap API Key Leaked in Source Code
- **File:** `crates/utils/src/tokens_manager/price_oracle.rs`, line ~107
- **Description:** A live CoinMarketCap API key (`59f46c6e-71da-49df-8b3b-d925eedbd894`) is hardcoded as the fallback value when the `CMC_API_KEY` environment variable is not set. This key is committed in source code and can be abused by anyone with repo access.
- **Impact:** API key theft, quota exhaustion, potential billing abuse.
- **Fix:** Remove the hardcoded key. Use `std::env::var("CMC_API_KEY").map_err(|_| anyhow::anyhow!("CMC_API_KEY not set"))?` and fail explicitly if not configured.

### C-2: Wallet Signature Verification is Completely Bypassed (Authentication Bypass)
- **File:** `crates/api/src/accounts/login.rs`, functions `verify_joyid_signature()` and `verify_generic_signature()`
- **Description:** Both signature verification functions **skip actual cryptographic verification** and simply derive a lock_hash from the user-supplied `address` field. The pubkey and signature fields are parsed but never verified. Any attacker can log in as any CKB address by supplying any address string without a valid signature.
- **Impact:** Complete authentication bypass — any user can impersonate any wallet address, claim other users' points, and perform actions on their behalf.
- **Fix:** Implement actual WebAuthn P-256 verification for JoyID and secp256k1 ECDSA recovery + verification for MetaMask/UniPass/OKX. Verify the recovered public key matches the claimed address's lock_args.

### C-3: Sequencer Can Front-Run User Swaps (Ordering Manipulation)
- **File:** `crates/intent-solver/src/lib.rs`, function `solve_batch()`; `crates/utils/src/liquidity_pairs/batch_tx.rs`, function `build_batch_swap_tx()`
- **Description:** The sequencer processes intents in the order they are iterated from the database/input array. There is **no commit-reveal scheme, no timestamp-based ordering enforcement, and no verifiable fairness mechanism**. The sequencer operator can:
  1. Observe pending intents (visible in DB/Redis)
  2. Insert their own intent at the front of the batch
  3. Back-run the user's swap at the now-shifted price
  This is classic MEV/sandwich attack by the sequencer itself.
- **Impact:** Sequencer operator can extract value from every swap by front-running, causing users to receive worse prices.
- **Fix:** Implement commit-reveal ordering, use a verifiable delay function (VDF), enforce strict FIFO with cryptographic proofs, or use encrypted mempools. At minimum, batch ordering should be deterministic (e.g., sorted by intent hash) and auditable.

### C-4: No API Authentication on Critical Intent Submission Endpoints
- **File:** `crates/api/src/lib.rs` (route configuration)
- **Description:** The `/api/v1/intents/*` endpoints (swap-exact-input-for-output, swap-input-for-exact-output, add-liquidity, remove-liquidity) have **no authentication middleware applied**. The JWT middleware exists in `crates/utils/src/oauth_middleware/middleware.rs` but is **never wired into the route configuration**. Any unauthenticated user can submit intents.
- **Impact:** Unauthenticated access to all trading endpoints. Combined with C-2, the entire auth system is non-functional.
- **Fix:** Apply the JWT authentication middleware to all `/intents/*`, `/tasks/*`, and `/accounts/info` routes. Example: wrap the scope with `.wrap(from_fn(jwt_auth_middleware))`.

---

## HIGH Severity

### H-1: Integer Overflow in AMM Calculations (u128 Multiplication)
- **File:** `crates/intent-solver/src/lib.rs`, functions `calculate_swap_exact_input()`, `calculate_swap_exact_output()`, `calculate_add_liquidity()`
- **Description:** The AMM formulas perform `u128 * u128` multiplications without overflow protection. For example:
  - `fee_adjusted * reserve_out` where both can be up to ~10^38 each
  - `reserve_in * amount_out * 10000` — triple multiplication can exceed u128::MAX (3.4 × 10^38)
  - `amount_x * amount_y` in initial liquidity can overflow for large token amounts
  
  CKB UDT tokens can have up to 10^38 supply (u128). With reserves approaching these values, multiplications **will overflow and panic** in debug mode or silently wrap in release mode, causing incorrect swap amounts.
- **Impact:** Panics crashing the sequencer, or silent wraparound producing incorrect (potentially zero or tiny) output amounts — user fund loss.
- **Fix:** Use `checked_mul()` / `checked_div()` or switch to `num-bigint::BigUint` (already a dependency) for all AMM calculations. Return error on overflow.

### H-2: Inconsistent Swap Formulas Between Solver and Checker
- **File:** `crates/intent-solver/src/lib.rs` function `calculate_swap_exact_input()` vs `crates/utils/src/liquidity_pairs/batch_tx.rs` function `calculate_swap()`
- **Description:** Two different AMM implementations exist:
  - **Solver (lib.rs):** `amount_out = (amount_in * (10000 - fee) * reserve_out) / (reserve_in * 10000 + amount_in * (10000 - fee))` — fee deducted from input first, then constant product applied.
  - **batch_tx.rs:** `fee = amount_in * fee_rate / 10000; amount_out = reserve_out * (amount_in - fee) / (reserve_in + amount_in - fee)` — fee explicitly subtracted first.
  
  While mathematically equivalent for small values, integer division ordering differences can cause **divergent results** for large amounts, leading to the checker accepting intents that the solver rejects (or vice versa).
- **Impact:** Intents could pass validation but fail during batch processing, or be incorrectly refunded.
- **Fix:** Consolidate into a single AMM calculation function used by both solver and batch builder. Remove the duplicate implementation.

### H-3: No Rate Limiting on Intent Submission
- **File:** `crates/api/src/intents/swap_exact_input_for_output.rs`, `crates/api/src/lib.rs`
- **Description:** No rate limiting is applied to any API endpoint. An attacker can flood the sequencer with millions of intents, causing:
  1. Database storage exhaustion
  2. Redis memory exhaustion
  3. Batch processing delays for legitimate users
  4. CKB RPC node overload
- **Impact:** Denial of service; legitimate users' swaps delayed indefinitely.
- **Fix:** Add per-IP and per-account rate limiting using `actix-governor` or Redis-based token bucket. Limit to e.g., 10 intents per minute per address.

### H-4: Distributed Lock Race Condition (Non-Atomic Release)
- **File:** `crates/utils/src/liquidity_pairs/lock.rs`, `PoolLock::Drop` impl
- **Description:** The pool lock release in `Drop` spawns an async task to delete the Redis key. This is **fire-and-forget**: if the Redis connection fails or the Tokio runtime is shutting down, the lock is never released and the pool becomes permanently locked (30s TTL mitigates but doesn't solve). Additionally, there is no lock ownership verification — any process can delete any lock, causing concurrent batch processing.
- **Impact:** Either pool lockouts (no processing for 30s) or concurrent batch processing of the same pool leading to double-spend of pool reserves.
- **Fix:** Use Redlock pattern with a unique lock value (UUID), and verify ownership on release with a Lua script: `if redis.call("get", KEYS[1]) == ARGV[1] then redis.call("del", KEYS[1]) end`. Consider using the `redlock-rs` crate.

### H-5: UTXO Global API Key Not Validated
- **File:** `crates/api/src/external/swap_utxo_global.rs`, `crates/api/src/external/get_utxo_global.rs`
- **Description:** Both external UTXO Global endpoints read the `X-API-Key` header and **log it** but never validate it against `ctx.config.sequencer_utxo_global_api_key`. The key is logged in plaintext (`tracing::info!("UTXO Global swap request from key={}", api_key)`), leaking partner API keys to log storage.
- **Impact:** Unauthenticated access to partner integration endpoints; API key leakage via logs.
- **Fix:** Compare `api_key` against `ctx.config.sequencer_utxo_global_api_key` using constant-time comparison. Return 401 on mismatch. Remove key from log output.

### H-6: GitHub Issue Creation Endpoint is Unauthenticated and Exploitable
- **File:** `crates/api/src/github/create_issue.rs`
- **Description:** The `/api/v1/github/issue` endpoint accepts arbitrary `title` and `body` from any unauthenticated user and creates GitHub issues using the server's `github_token`. An attacker can:
  1. Create unlimited spam issues on the project's GitHub repository
  2. Potentially inject malicious content or phishing links
  3. Abuse the GitHub API token's rate limit
- **Impact:** Repository spam, GitHub token rate limit exhaustion, reputational damage.
- **Fix:** Require JWT authentication. Add rate limiting (e.g., 1 issue per user per hour). Sanitize title/body content.

### H-7: Task Points Claim Has No Authentication — Account ID Spoofing
- **File:** `crates/api/src/tasks/claim.rs`
- **Description:** The `/api/v1/tasks/claim` endpoint accepts `account_id` directly from the request body with **no JWT authentication check**. Any attacker can claim points for any account by guessing/enumerating account IDs (sequential integers).
- **Impact:** Points system abuse — attacker can claim all task rewards for any account.
- **Fix:** Extract `account_id` from the JWT token claims (like `accounts/info.rs` does) instead of accepting it from the request body. Apply JWT middleware.

---

## MEDIUM Severity

### M-1: CORS Allows Any Origin
- **File:** `src/main.rs`, lines 68-72
- **Description:** CORS is configured with `.allow_any_origin().allow_any_method().allow_any_header()`. This allows any website to make authenticated API calls on behalf of users if they have valid JWT tokens (stored in localStorage).
- **Impact:** Cross-site request forgery from any malicious website.
- **Fix:** Restrict `allow_any_origin()` to specific frontend domain(s). Use `.allowed_origin("https://app.utxoswap.io")`.

### M-2: JWT Secret Defaults to Empty String
- **File:** `src/config.rs`, `jwt_secret` field with `#[serde(default)]`
- **Description:** If `JWT_SECRET` environment variable is not set, it defaults to an empty string `""`. JWT tokens signed with an empty secret are trivially forgeable.
- **Impact:** If deployed without JWT_SECRET configured, all JWT authentication is bypassed.
- **Fix:** Make `jwt_secret` a required field (remove `#[serde(default)]`) or validate at startup that it's non-empty and sufficiently long (≥32 bytes).

### M-3: Refund Intent Uses intent_id as Array Index (Out-of-Bounds)
- **File:** `crates/intent-solver/src/tx.rs`, line 82
- **Description:** `let idx = refund.intent_id as usize;` treats intent_id (a database primary key) as an array index into `intent_cells`. Intent IDs are database auto-increment values (e.g., 50001) while `intent_cells` may have only 5 elements. The `if let Some(cell) = intent_cells.get(idx)` prevents panic, but causes **silent refund failure** — the user's funds are consumed but never refunded.
- **Impact:** User fund loss on failed intents when intent_id > batch size.
- **Fix:** Build a HashMap<u64, usize> mapping intent_id to cell index, or use the batch-local index.

### M-4: Remove Liquidity Underflow Risk
- **File:** `crates/intent-solver/src/lib.rs`, `process_single_intent()` — RemoveLiquidity branch
- **Description:** `pair.asset_x_reserve -= amount_x` and `pair.total_lp_supply -= intent.amount_in` can underflow if `amount_x > pair.asset_x_reserve` due to rounding issues in `calculate_remove_liquidity`. In Rust release mode (no overflow checks), this wraps around to u128::MAX, corrupting pool state.
- **Impact:** Pool state corruption leading to all subsequent calculations being wrong; potential total fund loss from the pool.
- **Fix:** Use `checked_sub()` and return error on underflow. Add assertion: `assert!(amount_x <= pair.asset_x_reserve)`.

### M-5: Swap Does Not Verify Output Token Type Script Args
- **File:** `crates/intent-solver/src/lib.rs`, SwapEvent construction
- **Description:** When creating `SwapEvent`, the `output_token_type_script` uses `args: Vec::new()` (empty args). UDT type scripts on CKB typically require specific args (e.g., owner lock hash). Using empty args may produce an invalid cell that CKB rejects, or worse, creates a cell with incorrect type script that doesn't match the intended token.
- **Impact:** Transaction rejection or user receives wrong/invalid token cells.
- **Fix:** Copy the actual type script args from the pool configuration or intent metadata.

### M-6: No Validation of CKB Transaction Before Submission
- **File:** `crates/api/src/intents/swap_exact_input_for_output.rs`, function `submit_tx_to_ckb()`
- **Description:** The endpoint submits the user-provided raw transaction bytes directly to CKB RPC with "passthrough" mode, without:
  1. Verifying the transaction structure is valid
  2. Checking that outputs contain a proper intent cell
  3. Verifying the sequencer lock script is correctly used
  4. Checking the cell capacity covers the minimum CKB requirements
  An attacker could submit malformed transactions that waste CKB node resources.
- **Impact:** Malformed transactions polluting the CKB mempool; potential denial of service to the CKB node.
- **Fix:** Deserialize the CKB transaction, validate its structure, verify intent cell outputs, and check script hashes before forwarding to the node.

### M-7: Price Oracle Fallback Returns Stale Hardcoded Price
- **File:** `crates/utils/src/tokens_manager/price_oracle.rs`, line 115 and 130
- **Description:** When the CMC API fails, `fetch_ckb_price()` returns a hardcoded fallback of `0.005`. This stale price could be drastically different from the real market price, causing all derived token prices and TVL calculations to be incorrect.
- **Impact:** Inaccurate price display; users may make trading decisions based on wrong prices.
- **Fix:** Cache the last known good price in Redis with a TTL. Only use stale cache, never a hardcoded value. Alert operators when price fetch fails.

### M-8: Batch Processing Has No Maximum Batch Size
- **File:** `crates/utils/src/liquidity_pairs/manager.rs`, function `process_pending_intents()`
- **Description:** All pending intents for a pool are fetched and processed in a single batch with no upper limit. If 10,000 intents are pending, the batch transaction could exceed CKB's transaction size limit (596KB), causing the entire batch to fail and all intents to be stuck.
- **Impact:** Batch failure causing processing backlog; users' intents stuck in "Processing" state indefinitely.
- **Fix:** Limit batch size to e.g., 50-100 intents per transaction. Process remaining in subsequent batches.

---

## LOW Severity

### L-1: Debug Log Exposes API Keys and Tokens
- **File:** `crates/api/src/external/get_utxo_global.rs` line 32, `crates/api/src/external/swap_utxo_global.rs` line 14
- **Description:** API keys from `X-API-Key` header are logged via `tracing::info!` and `tracing::debug!` in plaintext.
- **Fix:** Remove API key from log messages. Log only a masked version (e.g., first 4 chars + "****").

### L-2: GitHub Token Exposed in Error Responses
- **File:** `crates/api/src/github/create_issue.rs`
- **Description:** If the GitHub API returns an error, the full response body (which may contain token-related error details) is passed to `ApiError::Internal()`. While `Internal` errors are masked in the HTTP response, they are logged with `tracing::error!`.
- **Fix:** Avoid passing raw external API error details through. Log a sanitized message.

### L-3: Missing Input Validation on Hex String Lengths
- **File:** `crates/api/src/pools/status.rs`, `crates/api-common/src/intents.rs`
- **Description:** The `poolTypeHash` query parameter and `tx` request field accept arbitrary length hex strings. Extremely long strings could cause memory allocation issues.
- **Fix:** Validate expected lengths (e.g., pool type hash should be exactly 64 hex chars / 32 bytes).

### L-4: `check_add_liquidity()` Performs Minimal Validation
- **File:** `crates/types/src/intent/checker.rs`, function `check_add_liquidity()`
- **Description:** Only checks `amount_in > 0`. Does not validate that the provided asset type hashes match the pool's actual assets, that the ratio is reasonable, or that the min_amount_out (used as asset_y amount) is valid.
- **Fix:** Add asset type hash matching against pool info. Validate both amounts > 0.

### L-5: `mark_processing()` TOCTOU Race
- **File:** `crates/utils/src/intents_manager/manager.rs`
- **Description:** `mark_processing()` filters by `Status::Pending` in the UPDATE, which is good. However, there's a gap between `get_pending_intents()` and `mark_processing()` where another instance could also fetch and process the same intents (if the distributed lock is not held).
- **Fix:** This is partially mitigated by the distributed lock. Ensure the lock is always acquired before `get_pending_intents()`. Consider using SELECT ... FOR UPDATE with database-level locking.

---

## Summary Table

| ID | Severity | Category | File | Issue |
|----|----------|----------|------|-------|
| C-1 | CRITICAL | Secret Leak | price_oracle.rs | Hardcoded CMC API key |
| C-2 | CRITICAL | Auth Bypass | login.rs | Signature verification skipped |
| C-3 | CRITICAL | Front-running | lib.rs, batch_tx.rs | Sequencer can reorder/front-run |
| C-4 | CRITICAL | Auth Missing | lib.rs (routes) | No auth on intent endpoints |
| H-1 | HIGH | Overflow | lib.rs (solver) | u128 multiplication overflow |
| H-2 | HIGH | Logic Bug | lib.rs vs batch_tx.rs | Inconsistent AMM formulas |
| H-3 | HIGH | DoS | routes | No rate limiting |
| H-4 | HIGH | Race Condition | lock.rs | Non-atomic lock release |
| H-5 | HIGH | Auth Missing | external/*.rs | API key not validated |
| H-6 | HIGH | Auth Missing | create_issue.rs | Unauthenticated GitHub issue creation |
| H-7 | HIGH | Auth Missing | claim.rs | Account ID spoofing in points claim |
| M-1 | MEDIUM | CORS | main.rs | Allow any origin |
| M-2 | MEDIUM | Config | config.rs | JWT secret defaults to empty |
| M-3 | MEDIUM | Fund Loss | tx.rs | intent_id used as array index |
| M-4 | MEDIUM | Overflow | lib.rs | Remove liquidity underflow |
| M-5 | MEDIUM | Logic Bug | lib.rs | Empty type script args |
| M-6 | MEDIUM | Validation | swap_exact_input.rs | No tx validation before submit |
| M-7 | MEDIUM | Oracle | price_oracle.rs | Stale hardcoded fallback price |
| M-8 | MEDIUM | DoS | manager.rs | No max batch size |
| L-1 | LOW | Log Leak | external/*.rs | API key in logs |
| L-2 | LOW | Log Leak | create_issue.rs | GitHub error in logs |
| L-3 | LOW | Validation | status.rs | No hex length validation |
| L-4 | LOW | Validation | checker.rs | Minimal add_liquidity checks |
| L-5 | LOW | Race Condition | manager.rs | TOCTOU in intent processing |

---

## Recommendations Priority

1. **Immediate (before any deployment):** Fix C-1, C-2, C-4 — rotate the leaked API key, implement signature verification, add authentication middleware.
2. **Before mainnet:** Fix C-3, H-1, H-2, H-4, M-3, M-4 — these can directly cause fund loss or enable value extraction.
3. **Before public launch:** Fix H-3, H-5, H-6, H-7, M-1, M-2 — authentication and DoS prevention.
4. **Ongoing:** Address remaining Medium and Low items during normal development cycles.
