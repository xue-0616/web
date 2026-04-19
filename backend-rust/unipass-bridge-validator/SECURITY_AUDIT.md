# Security Audit: unipass-bridge-validator

**Audit Date:** 2026-04-15
**Scope:** All 39 `.rs` source files in `backend-rust/unipass-bridge-validator/` (excluding `target/`)
**Risk Context:** Cross-chain bridges are the #1 target for crypto exploits (>$2B stolen historically). This system handles cross-chain asset transfers requiring signature-based validation.

---

## Executive Summary

**Overall Risk: 🔴 CRITICAL**

The codebase is largely a **skeleton/stub implementation** with most critical security functions **unimplemented**. The core validation function unconditionally returns `true`, meaning any payment request is treated as valid. The signer module contains **syntax errors** and cannot compile. There is **zero replay protection**, **zero API authentication**, **zero on-chain verification**, and **zero threshold/multisig enforcement**. If deployed in its current state, **all bridged funds would be at immediate risk of theft**.

---

## Findings

### CRITICAL Severity

---

#### C-01: Core Validation Always Returns `true` — No Actual Verification

- **File:** `crates/validator-handler/src/handler.rs`
- **Lines:** All of `validate_payment()`
- **Description:** The `validate_payment()` function, which is the central security gate for the entire bridge, contains only comments and unconditionally returns `Ok(true)`. No transaction receipt is fetched, no event logs are parsed, no amounts are verified, no token addresses are checked. Any crafted request claiming a bridge deposit would be accepted.
- **Impact:** An attacker can fabricate bridge payment claims with arbitrary amounts and drain all destination-chain funds.
- **Suggested Fix:** Implement full on-chain verification:
  1. Fetch the transaction receipt from the source chain RPC using `eth_getTransactionReceipt`.
  2. Parse and match `BridgeEvent` logs against the claimed parameters (sender, recipient, token, amount, destChainId).
  3. Verify the log originated from the legitimate bridge contract address.
  4. Verify the source transaction has sufficient block confirmations (e.g., 64 for Ethereum, 256+ for PoS chains with reorg risk).
  5. Verify the amount matches exactly — no rounding, no truncation.

---

#### C-02: Payment API Endpoint Returns `"validated"` Without Verification

- **File:** `crates/validator/src/api/payment.rs`
- **Lines:** `handler()` function
- **Description:** The POST `/api/v1/payment` endpoint accepts a `ValidatePaymentRequest`, logs it, and immediately returns `{"status": "validated"}` without performing any verification — no DB lookup, no on-chain check, no signature generation. Combined with C-01, this means the API rubber-stamps every request.
- **Impact:** Anyone who discovers the API endpoint can submit forged bridge transfers and receive a validated response, which could be relayed to drain destination-chain bridge contracts.
- **Suggested Fix:** Implement the full validation pipeline: verify on-chain, sign attestation, store in DB, queue for batching. Return appropriate status codes (`pending`, `confirmed`, `rejected`).

---

#### C-03: Signer Module Has Syntax Errors — Cannot Compile

- **File:** `crates/validator-signer/src/lib.rs`
- **Description:** The file defines a `ValidatorSigner` struct with a `wallet` field and a `new()` method, but then has dangling code outside any `impl` block or function:
  ```rust
  let wallet = ethers::signers::LocalWallet::from_bytes(&self.private_key)?;
  let signature = wallet.sign_hash(ethers::types::H256::from_slice(payment_hash))?;
  ```
  This references `self.private_key` (which doesn't exist — the field is `wallet`), and `payment_hash` is undefined. This file will not compile, meaning **the signing infrastructure does not exist**.
- **Impact:** No validator signatures can be produced. The bridge cannot function, or if a workaround exists, it bypasses signature validation entirely.
- **Suggested Fix:** Implement a proper `sign_payment_hash()` method:
  ```rust
  impl ValidatorSigner {
      pub async fn sign_payment_hash(&self, payment_hash: &[u8; 32]) -> anyhow::Result<ethers::types::Signature> {
          use ethers::signers::Signer;
          let hash = ethers::types::H256::from_slice(payment_hash);
          let signature = self.wallet.sign_hash(hash)?;
          Ok(signature)
      }
  }
  ```

---

#### C-04: No Replay Attack Protection

- **Files:** `crates/validator-handler/src/handler.rs`, `crates/validator/src/api/payment.rs`, `crates/validator-monitor/src/monitor.rs`
- **Description:** There is no mechanism to prevent the same bridge event from being processed multiple times:
  - No deduplication by `(chain_id, tx_hash, log_index)` composite key.
  - No "processed" status tracking before signing.
  - The DB schema (`bridge_event`) has no unique constraint enforcement in the application layer.
  - `poll_events` does not track `last_synced_block` properly — the `last_block` in `ChainConfig` is hardcoded and never updated.
- **Impact:** An attacker (or even a bug) can replay the same bridge deposit event repeatedly, causing the validator to sign multiple attestations for the same deposit, draining the destination-chain bridge contract.
- **Suggested Fix:**
  1. Before processing any event, check for existence using `(chain_id, tx_hash, log_index)` as a unique key.
  2. Use database transactions with `INSERT ... ON CONFLICT DO NOTHING` semantics.
  3. Persist `last_synced_block` to the `chain_info` table after each successful poll.
  4. Add idempotency keys to the Redis message queue.

---

#### C-05: No Threshold/Multisig Validation

- **File:** `crates/contracts-abi/src/unipass_bridge.rs` (ABI definition), entire codebase
- **Description:** The bridge contract ABI defines `requiredSignatures()` and `validators(index)` functions, indicating a multisig/threshold scheme is required on-chain. However, **there is no code anywhere** that:
  - Queries the required signature threshold from the contract.
  - Collects signatures from multiple validators before submission.
  - Verifies that collected signatures meet the threshold.
  - Validates that signers are authorized validators on the contract.
- **Impact:** If the contract requires N-of-M signatures, this validator cannot participate correctly. If only one validator is needed and it's this one, the single-point-of-failure risk is extreme.
- **Suggested Fix:** Implement a signature aggregation protocol:
  1. Query `requiredSignatures()` on startup and cache.
  2. Exchange partial signatures with other validators (via MQ or P2P).
  3. Only submit batches when threshold is met.
  4. Verify each collected signature against on-chain `validators(i)` list.

---

### HIGH Severity

---

#### H-01: Zero API Authentication — All Endpoints Public

- **Files:** `src/main.rs`, `crates/validator/src/lib.rs`
- **Description:** The HTTP server uses `Cors::permissive()` and has no authentication middleware. The POST `/api/v1/payment` endpoint (which triggers validation) is callable by anyone on the internet with no API key, JWT, HMAC, or any other auth mechanism.
- **Impact:** Any internet user can submit fake bridge payment claims. Combined with C-01/C-02, this is a direct path to fund theft.
- **Suggested Fix:**
  1. Add HMAC or JWT-based authentication middleware.
  2. Restrict CORS to known frontend origins.
  3. Add IP allowlisting for validator-to-validator communication.
  4. Add rate limiting per IP/key.

---

#### H-02: Private Key Loaded from Plain Environment Variable

- **File:** `crates/configs/src/configs.rs`
- **Description:** `validator_private_key` is loaded from an environment variable as a plain `String`. It has `#[serde(default)]` meaning it defaults to an empty string if not set. There is no validation that the key is present, no secure memory handling (zeroization), and the key persists in the `ValidatorConfig` struct which is `.clone()`d and passed to multiple subsystems.
- **Impact:**
  - Key may appear in process listings (`/proc/*/environ`), crash dumps, or log outputs.
  - Empty-string default means the system may silently operate with no key or an invalid key.
  - No zeroization means the key remains in memory indefinitely.
- **Suggested Fix:**
  1. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, or at minimum a file with restricted permissions).
  2. Use `secrecy::SecretString` for in-memory key storage with automatic zeroization.
  3. Validate on startup that the key is present and produces a valid address.
  4. Never clone the key — use `Arc<ValidatorSigner>` instead of passing config around.

---

#### H-03: No On-Chain Event Log Verification

- **File:** `crates/validator-monitor/src/monitor.rs`
- **Description:** `poll_events()` fetches logs via `eth_getLogs` RPC but:
  1. Only logs the count — does not parse, decode, or verify any log data.
  2. Does not verify the log came from the actual bridge contract (topic matching only, no address verification beyond the filter parameter).
  3. Does not verify block finality before processing.
  4. Does not check for chain reorganizations.
  5. Never updates `last_synced_block`, so on restart it reprocesses from the same block (or from 0 if not configured).
- **Impact:** A compromised or malicious RPC node can inject fake events. Reorg-susceptible chains (PoS chains with shallow finality) could cause the validator to process events that later get reverted, leading to double-spending.
- **Suggested Fix:**
  1. Decode event logs using the `UniPassBridge` ABI and verify all fields.
  2. Wait for sufficient block confirmations (chain-specific finality).
  3. Implement reorg detection: compare parent hashes, re-verify on block changes.
  4. Persist `last_synced_block` to DB after processing each batch.
  5. Use multiple RPC endpoints for cross-verification.

---

#### H-04: submit_batch Is a Stub — No Transaction Submission Safety

- **File:** `crates/validator-submitter/src/submitter.rs`
- **Description:** `submit_batch()` is completely unimplemented (only comments and returns `Ok(())`). The related `estimate_batch_gas()` uses a hardcoded formula with no safety limits, and `safe_nonce()` is a naive addition with no protection against nonce gaps or stuck transactions.
- **Impact:** When implemented, without proper safeguards:
  - No gas price caps → an attacker manipulating gas prices could drain the validator's ETH.
  - No nonce management → stuck transactions cause cascading failures.
  - No transaction confirmation monitoring → funds could be lost to failed transactions.
- **Suggested Fix:**
  1. Implement gas price caps (e.g., max 500 gwei, configurable).
  2. Use proper nonce management with gap detection and replacement transactions.
  3. Monitor pending transactions and implement automatic speedup/cancellation.
  4. Add transaction simulation (`eth_call`) before sending.
  5. Implement idempotent batch submission keyed by batch ID.

---

#### H-05: Redis Message Queue Has No Authentication or Integrity Checks

- **Files:** `crates/validator-mq/src/consumer.rs`, `crates/validator-mq/src/producer.rs`
- **Description:** The Redis streams (XADD/XREADGROUP) are used to pass validated payment messages between components. There is:
  1. No message signing/HMAC — any process with Redis access can inject fake "validated" messages.
  2. No message schema validation on consumption.
  3. Code contains `self` references in standalone functions (won't compile).
  4. No acknowledgment (XACK) of processed messages — messages may be reprocessed.
- **Impact:** If Redis is compromised (common in shared infrastructure), an attacker can inject fabricated validation messages, bypassing all verification steps and directly triggering fund disbursement.
- **Suggested Fix:**
  1. Sign messages with the validator's key before publishing; verify on consumption.
  2. Use Redis AUTH and TLS.
  3. Implement proper XACK after successful processing.
  4. Add schema validation on message deserialization.
  5. Fix the compilation errors (use proper struct methods).

---

#### H-06: No Input Validation on Bridge Payment Request

- **File:** `crates/validator/src/api/payment.rs`
- **Description:** The `ValidatePaymentRequest` struct accepts:
  - `source_chain_id` / `dest_chain_id`: No validation that these are supported chains.
  - `tx_hash`: No format validation (could be empty or non-hex).
  - `amount`: A `String` with no numeric validation — could be negative, zero, or astronomically large.
  - `token_address` / `recipient`: No address format validation.
  The utility functions `is_valid_tx_hash()` and `is_valid_address()` exist in `validator-handler/src/utils.rs` but are **never called**.
- **Impact:** Malformed requests could cause panics, logic errors, or injection attacks in downstream processing.
- **Suggested Fix:**
  1. Validate all fields before processing: use `is_valid_tx_hash()`, `is_valid_address()`.
  2. Validate chain IDs against a whitelist of supported chains.
  3. Parse amount as `U256` and enforce minimum/maximum bounds.
  4. Return 400 Bad Request for invalid inputs with specific error descriptions.

---

### MEDIUM Severity

---

#### M-01: CORS Set to Permissive — Any Origin Can Call API

- **File:** `src/main.rs`
- **Description:** `actix_cors::Cors::permissive()` allows requests from any origin with any headers/methods. Combined with the lack of authentication, this exposes the bridge validator API to cross-site attacks from any webpage.
- **Impact:** An attacker could craft a malicious webpage that calls the bridge API from a victim's browser.
- **Suggested Fix:** Configure CORS with explicit allowed origins, methods, and headers.

---

#### M-02: No Rate Limiting on API Endpoints

- **Files:** `src/main.rs`, `crates/validator/src/lib.rs`
- **Description:** No rate limiting middleware is configured. The validation endpoint could be called millions of times per second.
- **Impact:** Denial of service; resource exhaustion; if validation triggers expensive on-chain calls, gas drain.
- **Suggested Fix:** Add rate limiting middleware (e.g., `actix-governor`) with per-IP and global limits.

---

#### M-03: Scheduler/Monitor Run in Infinite Loops With No Graceful Shutdown

- **Files:** `crates/validator-scheduler/src/lib.rs`, `crates/validator-monitor/src/lib.rs`
- **Description:** Both background tasks use `loop { ... tokio::time::sleep(...).await }` with no cancellation token. Errors are logged but the loops continue indefinitely.
- **Impact:** Cannot gracefully drain in-flight operations on shutdown; potential for partial batch submissions; database inconsistency.
- **Suggested Fix:** Use `tokio::select!` with a `CancellationToken` for clean shutdown.

---

#### M-04: `last_synced_block` Never Updated — Reprocessing on Restart

- **Files:** `crates/validator-monitor/src/monitor.rs`, `crates/validator-daos/src/chain_info.rs`
- **Description:** The `chain_info` table has a `last_synced_block` field, but the monitor code never reads from or writes to this table. The `ChainConfig` struct is populated from an empty `Vec::new()` in the scheduler.
- **Impact:** On every restart, the monitor would reprocess all events from block 0 (or whatever the initial config is), re-signing already-processed payments.
- **Suggested Fix:** Read `last_synced_block` from DB on startup; update atomically after each successful processing batch.

---

#### M-05: No Token/Chain Whitelist Enforcement

- **Entire codebase**
- **Description:** There is no whitelist of supported tokens, no whitelist of supported chain pairs, and no maximum transfer amount. The ABI allows arbitrary `token` and `destChainId`.
- **Impact:** An attacker could craft bridge events for unsupported tokens or chains, potentially confusing the system. Without amount limits, a single compromised event could drain entire bridge reserves.
- **Suggested Fix:**
  1. Maintain a configurable whitelist of `(source_chain, dest_chain, token)` triples.
  2. Enforce per-transaction and per-period amount limits.
  3. Add circuit-breaker logic: halt if suspicious volume is detected.

---

#### M-06: Slack Webhook URL Exposed in Config — No Abuse Protection

- **File:** `crates/configs/src/configs.rs`, `crates/validator-log/src/slack_webhook_writer.rs`
- **Description:** The Slack webhook URL is in plain config with no validation. The `send_slack_message()` function doesn't check response status or rate-limit calls.
- **Impact:** If leaked, the webhook could be abused for spam. In a flood scenario, the logging system could be overwhelmed.
- **Suggested Fix:** Rate-limit Slack notifications; check for HTTP errors; treat the URL as a secret.

---

### LOW Severity

---

#### L-01: Apollo Configuration Client Is an Empty Shell

- **File:** `crates/configs/src/apollo_client.rs`
- **Description:** `ApolloClient` has a constructor but no methods. It appears intended for dynamic configuration but is unused.
- **Impact:** No dynamic config updates; all config changes require restart.
- **Suggested Fix:** Implement or remove. If implementing, add authentication and signature verification for config updates (config injection is a real attack vector).

---

#### L-02: Hardcoded Gas Estimation Formula

- **File:** `crates/validator-submitter/src/utils.rs`
- **Description:** `estimate_batch_gas()` uses `100_000 + 30_000 * payment_count` with no per-chain adjustment or safety margin.
- **Impact:** Gas estimation could be too low (transaction failure) or too high (wasted ETH). Different chains have different gas costs.
- **Suggested Fix:** Use `eth_estimateGas` RPC call with a safety multiplier; add per-chain gas limits.

---

#### L-03: No Database Migration or Schema Validation

- **Entire codebase**
- **Description:** SeaORM entities are defined but there are no migration files or schema validation on startup. The application assumes the database schema exists and matches.
- **Impact:** Schema drift could cause runtime errors or data corruption.
- **Suggested Fix:** Use SeaORM migrations; validate schema on startup.

---

#### L-04: Missing EIP-712 Typed Data Signing

- **File:** `crates/validator-signer/src/lib.rs`
- **Description:** The (broken) signer uses raw `sign_hash()`. For bridge validation, EIP-712 typed structured data signing should be used to prevent signature malleability and ensure domain separation between chains.
- **Impact:** Without EIP-712 domain separation, a signature for chain A could potentially be replayed on chain B if the message format is the same.
- **Suggested Fix:** Implement EIP-712 signing with a domain separator that includes chain ID and bridge contract address.

---

## Summary Table

| ID    | Severity   | Title                                                    | Status         |
|-------|------------|----------------------------------------------------------|----------------|
| C-01  | 🔴 CRITICAL | Core validation always returns `true`                    | Unimplemented  |
| C-02  | 🔴 CRITICAL | Payment API returns "validated" without verification     | Unimplemented  |
| C-03  | 🔴 CRITICAL | Signer module has syntax errors — won't compile          | Broken         |
| C-04  | 🔴 CRITICAL | No replay attack protection                              | Missing        |
| C-05  | 🔴 CRITICAL | No threshold/multisig validation                         | Missing        |
| H-01  | 🟠 HIGH     | Zero API authentication                                  | Missing        |
| H-02  | 🟠 HIGH     | Private key in plain environment variable                | Insecure       |
| H-03  | 🟠 HIGH     | No on-chain event log verification                       | Unimplemented  |
| H-04  | 🟠 HIGH     | submit_batch is a stub with no safety                    | Unimplemented  |
| H-05  | 🟠 HIGH     | Redis MQ has no auth or integrity checks                 | Missing        |
| H-06  | 🟠 HIGH     | No input validation on bridge payment request            | Missing        |
| M-01  | 🟡 MEDIUM   | CORS permissive                                          | Misconfigured  |
| M-02  | 🟡 MEDIUM   | No rate limiting                                         | Missing        |
| M-03  | 🟡 MEDIUM   | No graceful shutdown for background tasks                | Missing        |
| M-04  | 🟡 MEDIUM   | `last_synced_block` never updated                        | Bug            |
| M-05  | 🟡 MEDIUM   | No token/chain whitelist                                 | Missing        |
| M-06  | 🟡 MEDIUM   | Slack webhook URL exposed, no abuse protection           | Insecure       |
| L-01  | 🔵 LOW      | Apollo client is empty shell                             | Unimplemented  |
| L-02  | 🔵 LOW      | Hardcoded gas estimation                                 | Incomplete     |
| L-03  | 🔵 LOW      | No DB migrations or schema validation                    | Missing        |
| L-04  | 🔵 LOW      | Missing EIP-712 typed data signing                       | Missing        |

---

## Conclusion

**This bridge validator is NOT safe for production deployment.** The codebase is approximately 15-20% implemented. The structural scaffolding (project layout, DB models, ABI bindings, API routes) exists, but every critical security function — on-chain verification, signature generation, replay prevention, threshold enforcement, and secure key management — is either stub code, broken, or entirely missing.

**Minimum required before any testnet deployment:**
1. Fix the signer module compilation errors and implement proper EIP-712 signing.
2. Implement full on-chain event verification in `validate_payment()` and `poll_events()`.
3. Add replay protection with `(chain_id, tx_hash, log_index)` deduplication.
4. Add API authentication and input validation.
5. Implement threshold signature collection.
6. Add block finality checks per chain.
7. Implement proper `submit_batch()` with gas safety, nonce management, and confirmation monitoring.

**Estimated effort to bring to production-grade:** 4–8 weeks of dedicated security-focused development, followed by a professional third-party audit.
