# Security Audit Report — 3 Rust Backend Projects

**Date:** 2026-04-15  
**Scope:** utxoswap-farm-sequencer, unipass-wallet-relayer, huehub-token-distributor  
**Focus:** Authentication, fund safety, key handling, input validation, critical bugs

---

## Executive Summary

All three projects share common architectural patterns (actix-web, sea-orm, deadpool-redis, env-based config via `envy`). **None of the three have any API authentication or authorization middleware**. Combined with fully permissive CORS or no CORS at all, every endpoint is open to the public internet. The wallet-relayer carries a plaintext private key in its config struct that gets cloned into a context accessible from every handler. The token-distributor holds a `distributor_private_key` in its `Config` with `#[derive(Clone)]`, meaning the signing key lives in memory with zero protection. Several findings are fund-critical.

| Severity | Count |
|----------|-------|
| CRITICAL | 6     |
| HIGH     | 8     |
| MEDIUM   | 7     |
| LOW      | 5     |

---

## Project 1: utxoswap-farm-sequencer

**Purpose:** CKB farming/staking sequencer — accepts user intents (deposit/withdraw/harvest LP tokens), batches them, and submits CKB transactions.  
**Files reviewed:** 57 .rs files across 7 crates  
**Dependencies:** actix-web 4, sea-orm (MySQL), deadpool-redis, ckb-types/ckb-jsonrpc-types, molecule, reqwest

### CRITICAL

#### [P1-C1] No Authentication on Any Endpoint
- **Location:** `src/main.rs:45-49`, `crates/api/src/lib.rs`
- **Details:** All API routes (`/api/v1/intents/submit`, `/api/v1/intents/create-pool`, `/api/v1/intents/submit-create-pool`, `/api/v1/pools`, etc.) are publicly accessible with zero authentication. There are no JWT guards, API key checks, IP whitelists, or any auth middleware.
- **Impact:** Anyone can submit farming intents, potentially flooding the system or submitting malicious intents that the sequencer would process and submit to CKB.
- **Comment in code:** `create_pool_intent.rs` says "Check: reward token exists, LP token matches UTXOSwap pool, creator is authorized" — but this check is **not implemented**. The handler just logs and returns `{"status":"pending"}`.

#### [P1-C2] Fully Permissive CORS
- **Location:** `src/main.rs:45` — `actix_cors::Cors::permissive()`
- **Details:** CORS is set to allow **all origins, all methods, all headers**. Combined with no auth, any website can make cross-origin requests to every endpoint.
- **Impact:** Enables CSRF-like attacks where a malicious webpage visited by an operator could submit farming intents on their behalf.

### HIGH

#### [P1-H1] No Rate Limiting
- **Location:** `src/main.rs`, `crates/api/src/lib.rs`
- **Details:** No rate limiting middleware. The `/intents/submit` endpoint directly inserts into the database.
- **Impact:** Denial-of-service via flooding the intent queue, consuming DB storage and Redis resources.

#### [P1-H2] `create_pool_intent` and `submit_create_pool_intent` Are Unimplemented Stubs
- **Location:** `crates/api/src/intents/create_pool_intent.rs`, `crates/api/src/intents/submit_create_pool_intent.rs`
- **Details:** Both handlers accept `serde_json::Value` (arbitrary JSON) and return `{"status":"pending"}` without doing anything. The comment says "Validate creator permissions and pool parameters" but the code doesn't.
- **Impact:** If deployed, these endpoints accept arbitrary data and return success. Could confuse clients or be exploited if later implementation trusts data inserted by these stubs.

#### [P1-H3] CKB RPC Error Details Leaked to Client
- **Location:** `crates/api/src/intents/submit.rs:24` — `ApiError::Internal(format!("CKB RPC error: {}", e))`
- **Details:** Internal CKB RPC errors (including node URL, connection info) are propagated directly to the HTTP response body.
- **Impact:** Information disclosure — reveals backend infrastructure details.

#### [P1-H4] Internal Error Passthrough via `From<sea_orm::DbErr>`
- **Location:** `crates/api-common/src/error.rs:28` — `impl From<sea_orm::DbErr> for ApiError`
- **Details:** Database errors are converted to `ApiError::Internal(e.to_string())`, which includes raw SQL error messages, table names, constraint names, etc.
- **Impact:** SQL error leakage can reveal database schema to attackers.

### MEDIUM

#### [P1-M1] Unsafe `unwrap()` on Cell Data Parsing
- **Location:** `crates/types/src/parser.rs:36,41,44`
- **Details:** `u128::from_le_bytes(cell_data[33..49].try_into().unwrap())` — if `try_into()` fails (should not given prior length check, but the check is `< 97`, not `< 113`), this panics the server.
- **Impact:** A specially crafted intent with data between 97–112 bytes would panic on the `user_reward_debt` field parsing at line 44. The length check passes (`>= 97`), then the code tries `cell_data[97..113]` which exists in the `>= 113` branch (safe), but the else-branch defaults to 0 (safe). Overall low risk but the `unwrap()` on `try_into()` is unnecessary.

#### [P1-M2] Distributed Lock Without Fencing Token
- **Location:** `crates/utils/src/lock_manager.rs`, `crates/utils/src/pools_manager/lock.rs`
- **Details:** Redis `SET NX PX` distributed locks are used without fencing tokens. The `release()` method does a simple `DEL` without verifying ownership, meaning a different process could release a lock it doesn't own.
- **Impact:** Potential race condition in farm pool processing if lock TTL expires and two workers proceed simultaneously, leading to double-processing of intents.

#### [P1-M3] `SystemTime::now()` Used for Financial Logic
- **Location:** `crates/types/src/checker.rs:27`
- **Details:** `std::time::SystemTime::now()` is used to check if a pool has ended. Server clock drift could allow deposits after pool expiry or reject valid deposits.
- **Impact:** Minor financial accuracy issue — should use CKB chain timestamp.

### LOW

#### [P1-L1] `entity_crate` Import Alias Not Standard
- **Location:** Multiple files reference `entity_crate::` which is presumably a crate alias for the `entity` path dependency. If not properly configured, this would cause compilation failures.

#### [P1-L2] No TLS/HTTPS Enforcement
- **Location:** `src/main.rs:50` — `bind(("0.0.0.0", port))`
- **Details:** Server binds plain HTTP. TLS must be handled by a reverse proxy (assumed but not verified).

---

## Project 2: unipass-wallet-relayer

**Purpose:** EVM meta-transaction relayer for UniPass smart contract wallets — accepts user-signed calldata, wraps in `ModuleMain.execute()`, signs with relayer private key, and submits to Arbitrum/Polygon/BSC/Ethereum.  
**Files reviewed:** 38 .rs files across 10 crates  
**Dependencies:** actix-web 4, ethers 2, sea-orm (MySQL), deadpool-redis, reqwest

### CRITICAL

#### [P2-C1] No Authentication on Transaction Submission
- **Location:** `src/main.rs:28-33`, `crates/relayer/src/lib.rs`
- **Details:** The `/api/v1/transactions` POST endpoint (the core relay endpoint) has **zero authentication**. Anyone on the internet can submit meta-transactions for relay. There is no CORS middleware at all.
- **Impact:** **Funds at risk** — the relayer signs transactions with its own private key and pays gas. An attacker could drain the relayer's gas budget by submitting thousands of relay requests. Additionally, without signature verification (see P2-C2), arbitrary calldata could be relayed.

#### [P2-C2] Transaction Signature Verification Not Implemented
- **Location:** `crates/relayer/src/api/transactions.rs:28-35`
- **Details:** The handler comment says "1. Validate signature against wallet keyset" but the code does NOT implement this. The `signature` field from the request is accepted but never verified. Steps 2–8 are also commented out as pseudocode.
- **Impact:** **CRITICAL fund risk** — without signature verification, any attacker can submit arbitrary calldata to be relayed, potentially executing unauthorized operations on user wallets.

#### [P2-C3] Private Key in Config Struct with `Clone` + `Debug`
- **Location:** `crates/configs/src/lib.rs:29` — `pub relayer_private_key: String`
- **Details:** The relayer's private key (EVM hot wallet) is stored as a `String` in `RelayerConfig`, which derives `Debug` and `Clone`. This struct is:
  1. Cloned into `RelayerContext` (which is cloned per-request via `web::Data`)
  2. Derives `Debug`, meaning the private key would appear in any debug log of the config
  3. Accessible from every handler via `ctx.config.relayer_private_key`
- **Impact:** Private key exposure via debug logging, memory dumps, or error traces. No zeroization on drop.

#### [P2-C4] Broken `load_config()` — References `self` in Free Function
- **Location:** `crates/configs/src/lib.rs:34-45`
- **Details:** The `load_config()` function references `self.apollo_meta_url` and `self.app_id`, but it's a free function (`pub async fn load_config()`), not a method. This code **will not compile**. If it was patched to compile, it still has issues: Apollo config is fetched over plain HTTP without authentication, the response is parsed but not actually used (the result is discarded before `envy::from_env()` is called).
- **Impact:** Configuration loading is broken. If Apollo integration was intended for secret rotation, it's non-functional.

### HIGH

#### [P2-H1] No CORS Configuration
- **Location:** `src/main.rs:28-33`
- **Details:** Unlike Project 1 (which has `Cors::permissive()`), this project has **no CORS middleware at all**, meaning the browser's default same-origin policy applies. However, non-browser clients (scripts, bots) can still freely access all endpoints.
- **Impact:** Lower risk than permissive CORS for browser-based attacks, but no protection for server-to-server abuse.

#### [P2-H2] No Rate Limiting
- **Location:** `src/main.rs`, `crates/relayer/src/lib.rs`
- **Details:** No rate limiting on any endpoint, including the transaction submission endpoint.
- **Impact:** Relayer gas drain via flooding.

#### [P2-H3] Redis Stream Consumer Is a No-Op
- **Location:** `crates/relayer-redis/src/lib.rs:17-26`
- **Details:** The `consume_once()` function has all steps commented out as pseudocode. The consumer loop runs every 100ms doing nothing.
- **Impact:** Transactions queued to Redis will never be processed or submitted to the chain. If the system is partially deployed, users would see "queued" status forever.

#### [P2-H4] Simulate Endpoint References Undefined `ctx` and `req`
- **Location:** `crates/relayer/src/api/simulate.rs`
- **Details:** The handler function signature is `handler(body: web::Json<SimulateRequest>)` but the body references `ctx.config.rpc_url`, `req.to`, `req.data`, and `ctx.config.relayer_address` — none of which exist in scope. This code **will not compile**.
- **Impact:** Core simulation functionality is broken.

### MEDIUM

#### [P2-M1] Nonce and Receipt Endpoints Reference Undefined Variables
- **Location:** `crates/relayer/src/api/nonce.rs`, `crates/relayer/src/api/receipt.rs`, `crates/relayer/src/api/meta_nonce.rs`
- **Details:** All three handlers reference `ctx`, `ApiError`, `wallet_address`, etc. that are not in scope. Code will not compile.
- **Impact:** These info endpoints are non-functional.

#### [P2-M2] Apollo Config Fetched Over Unauthenticated HTTP
- **Location:** `crates/configs/src/lib.rs:38-42`
- **Details:** Apollo ConfigService is queried via plain HTTP GET without auth headers. Man-in-the-middle could inject malicious configuration.
- **Impact:** Config poisoning if network is not trusted.

### LOW

#### [P2-L1] Token Price Cache Never Refreshed
- **Location:** `crates/tokens-manager/src/lib.rs`
- **Details:** `TokensManager` has a `refresh()` method that calls CoinGecko, but it's never called from any background task.
- **Impact:** Fee estimation always returns 0/None.

#### [P2-L2] Hardcoded Gas Estimate
- **Location:** `crates/execute-validator/src/simulator/anvil_simulator.rs:31`, `contract_simulator.rs:25`
- **Details:** Both simulators return hardcoded `gas_used: U256::from(200_000)` instead of actual estimation.
- **Impact:** Inaccurate gas estimation could lead to transaction failures or overpayment.

---

## Project 3: huehub-token-distributor

**Purpose:** Token distribution service — polls pending mint/distribute tasks from DB and submits CKB transactions signed with a private key.  
**Files reviewed:** 10 .rs files across 3 crates  
**Dependencies:** actix-web 4, sea-orm (MySQL), reqwest, envy

### CRITICAL

#### [P3-C1] Private Key in Config with `#[derive(Clone)]` and No Protection
- **Location:** `src/main.rs:11` — `pub distributor_private_key: String`
- **Details:** The `Config` struct holds the CKB signing private key as a plain `String`. It derives `Clone` (implicit via `serde::Deserialize`). The entire `Config` including the private key is cloned into the background task:
  ```rust
  let cfg_bg = cfg.clone(); // clones the private key
  tokio::spawn(async move {
      loop {
          process_distributions(&db_bg, &cfg_bg).await // key accessible here
      }
  });
  ```
- **Impact:** Private key lives in multiple memory locations with no zeroization. Could be leaked via core dumps, debug logs, or memory inspection.

#### [P3-C2] Distribution Processing Is Completely Unimplemented
- **Location:** `src/main.rs:48-57` — `process_distributions()` function
- **Details:** The function that should query pending distributions, build CKB transactions, sign them, and submit them is a stub that just logs and returns `Ok(())`. Comments describe 5 steps but none are implemented.
- **Impact:** **No funds are actually distributed.** If deployed as-is, the system accepts distribution requests (via DB) but never processes them. Any operational dependency on this service would silently fail.

### HIGH

#### [P3-H1] No Authentication — Only a `/status` Endpoint Exists
- **Location:** `src/main.rs:38-40`
- **Details:** The only HTTP endpoint is `GET /status` which returns `{"status":"ok"}`. There's no CORS, no auth, no rate limiting. The web server appears to serve no useful API purpose — all work is done via the background poller reading from the database.
- **Impact:** Low direct API risk (only exposes a status endpoint), but the lack of any admin authentication means there's no way to securely manage the service.

### MEDIUM

#### [P3-M1] No Input Validation on DB Data
- **Location:** `src/main.rs:48-57`
- **Details:** When implemented, `process_distributions()` will query `distributor_tx` records and use `recipient_address` and `amount` fields. These are plain `String` fields with no validation constraints at the ORM/DB level.
- **Impact:** When implemented, malformed addresses or negative/overflow amounts from the database could cause unexpected behavior or fund loss.

#### [P3-M2] Database Connection String in Environment Without Encryption
- **Location:** `src/main.rs:7` — `database_url: String` loaded via `envy::from_env()`
- **Details:** Database URL (which may contain credentials) is loaded from environment. No validation that the URL uses TLS (`ssl-mode=required`).
- **Impact:** Database credentials could be intercepted if the connection is not encrypted.

#### [P3-M3] No Idempotency Protection on Distribution Processing
- **Location:** `src/main.rs:48-57`
- **Details:** The background loop runs every 5 seconds. When implemented, without proper status transitions and locking, the same pending distribution could be processed multiple times.
- **Impact:** Double-spending risk — same tokens distributed twice.

### LOW

#### [P3-L1] `distributor_private_key` Has `#[serde(default)]` — Allows Empty Key
- **Location:** `src/main.rs:11` — `#[serde(default)] pub distributor_private_key: String`
- **Details:** The private key field defaults to an empty string if not set. No startup validation ensures it's actually configured.
- **Impact:** Service starts successfully with no signing capability, silently failing to sign transactions.

---

## Cross-Cutting Findings

### [CC-1] CRITICAL: No Authentication Across All 3 Projects
All three projects expose HTTP endpoints with zero authentication. None implement:
- JWT/Bearer token auth
- API key verification
- IP whitelisting
- mTLS

### [CC-2] HIGH: No Hardcoded Secrets Found
Positive finding: no hardcoded private keys, API keys, or credentials were found in any `.rs` or `.toml` file. All secrets are loaded from environment variables via `envy`.

### [CC-3] MEDIUM: All Projects Bind to `0.0.0.0`
All three projects bind their HTTP servers to `0.0.0.0`, accepting connections from any network interface. This is standard for containerized deployments but dangerous if deployed on a machine with a public IP without a firewall.

### [CC-4] MEDIUM: No Graceful Shutdown Handling
None of the three projects implement graceful shutdown. Background tasks (farm pool processing, Redis consumers, distribution polling) will be killed mid-operation if the process receives SIGTERM.

### [CC-5] LOW: No Health Check Beyond `/status`
Only Projects 1 and 3 have `/status` endpoints. Project 2 has none. None check database or Redis connectivity in their health checks.

---

## Recommendations (Priority Order)

1. **[IMMEDIATE]** Add authentication middleware to all public-facing endpoints — at minimum API key auth with constant-time comparison
2. **[IMMEDIATE]** Implement proper signature verification in the wallet relayer before deployment
3. **[IMMEDIATE]** Replace `Cors::permissive()` with restrictive CORS allowing only known frontend origins
4. **[IMMEDIATE]** Wrap private keys in a `secrecy::Secret<String>` type that zeroizes on drop and prevents Debug/Display
5. **[HIGH]** Add rate limiting (e.g., `actix-governor` or Redis-based token bucket)
6. **[HIGH]** Implement the stub functions before deployment (relayer consumer, distributor processing, pool creation validation)
7. **[HIGH]** Sanitize all error responses — never expose internal errors (DB, RPC) to clients
8. **[MEDIUM]** Add startup validation for all required secrets (non-empty, correct format)
9. **[MEDIUM]** Implement proper distributed locking with fencing tokens or use database-level row locking
10. **[MEDIUM]** Add graceful shutdown handlers for background tasks
11. **[LOW]** Add comprehensive health checks that verify DB and Redis connectivity
