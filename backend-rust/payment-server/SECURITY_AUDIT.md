# Payment-Server Security Audit Report

**Date:** 2026-04-15  
**Scope:** `/backend-rust/payment-server/` — Full codebase security review  
**Auditor:** Automated Security Analysis  

---

## Executive Summary

The payment-server is a Rust-based payment gateway handling cryptocurrency and fiat money flows (on/off ramp, cross-chain transfers, invoicing, shopping). The audit identified **7 CRITICAL**, **6 HIGH**, **5 MEDIUM**, and **4 LOW** severity findings. The most severe issues are: **complete absence of authentication middleware on all API routes**, **missing webhook signature verification**, **permissive CORS**, and **secrets defaulting to empty strings**.

---

## Findings

### FINDING-01: No Authentication Middleware on Any Route
- **File:** `crates/api/src/lib.rs` (lines 14–56)
- **Severity:** 🔴 CRITICAL
- **Description:** The route configuration in `configure_routes()` registers all endpoints (payment/send, account/backup, invoice/create, shopping/order, assets/*, etc.) without any authentication guard, middleware, or JWT-verification extractor. While `login.rs` issues a JWT token, **no route verifies it**. A `grep` for `verify_token`, `Authorization`, and `Bearer` across the entire `crates/api/src` directory returned **zero matches** outside of login itself. This means:
  - Any unauthenticated user can call `POST /api/v1/payment/send` to initiate payment transactions.
  - Any unauthenticated user can call `POST /api/v1/account/backup` to overwrite wallet backups.
  - Any unauthenticated user can call `POST /api/v1/invoice/create` to create PayPal invoices.
  - Any unauthenticated user can call `POST /api/v1/shopping/order` to create Bitrefill orders.
- **Suggested Fix:** Implement an Actix-web middleware or extractor that:
  1. Reads the `Authorization: Bearer <token>` header.
  2. Calls `common::auth::verify_token()` to validate the JWT.
  3. Injects the authenticated `Claims` (user ID) into request extensions.
  4. Apply this middleware to all routes except `/account/login`, `/account/register`, `/account/recovery`, `/config`, and webhook endpoints.

---

### FINDING-02: Login Bypasses Signature Verification
- **File:** `crates/api/src/account/login.rs` (lines 17–23)
- **Severity:** 🔴 CRITICAL
- **Description:** The login handler accepts a `LoginRequest` containing `keyset_hash`, `signature`, and `message`, but the actual implementation **skips all signature verification**. The code has comments indicating steps 1-2 (verify signature via EIP-1271, check timestamp for replay protection), but the implementation jumps directly to issuing a JWT token using the user-supplied `keyset_hash` as the subject. An attacker can:
  1. Supply any arbitrary `keyset_hash` (e.g., another user's wallet identifier).
  2. Supply garbage `signature` and `message` values.
  3. Receive a valid JWT token for the victim's account.
- **Suggested Fix:** Implement the commented-out verification steps:
  1. Verify the `signature` against the `message` using EIP-1271 `isValidSignature(hash, sig)` call to the on-chain smart account.
  2. Validate the `message` contains a recent timestamp (within 5 minutes) to prevent replay attacks.
  3. Only issue the JWT after successful verification.

---

### FINDING-03: Webhook Endpoints Lack Signature Verification
- **File:** `crates/api/src/ramp/webhooks/alchemy_pay/on_ramp_webhook.rs` (lines 2–9)
- **File:** `crates/api/src/ramp/webhooks/alchemy_pay/off_ramp_webhook.rs` (lines 2–4)
- **Severity:** 🔴 CRITICAL
- **Description:** Both webhook handlers accept arbitrary JSON bodies and return `200 OK` without any signature verification. The on-ramp webhook has comments describing HMAC-SHA256 verification steps, but **none are implemented**. The `sign_util.rs` module and `common::crypto::verify_hmac_sha256()` exist but are never called. An attacker can:
  1. Send forged webhook payloads to `POST /api/v1/ramp/webhook/alchemy-pay/on-ramp`.
  2. Claim that a fiat payment was confirmed (triggering crypto delivery to attacker's wallet).
  3. Effectively steal funds by forging payment confirmations.
- **Suggested Fix:**
  1. Extract the `X-Timestamp` and `X-Signature` headers from the webhook request.
  2. Reconstruct the signing payload: `timestamp + raw_body`.
  3. Verify using `common::crypto::verify_hmac_sha256(alchemy_pay_secret_key, payload, signature)`.
  4. Reject with `401 Unauthorized` if verification fails.
  5. Add timestamp validation to prevent replay attacks (reject if > 5 minutes old).

---

### FINDING-04: JWT Secret Defaults to Empty String
- **File:** `crates/config/src/config.rs` (line 51)
- **Severity:** 🔴 CRITICAL
- **Description:** The `jwt_secret` field has `#[serde(default)]` which means it defaults to an empty string `""` if the environment variable is not set. An empty-string HMAC key is cryptographically meaningless — any attacker knowing the algorithm (HS256, which is the `jsonwebtoken` default) can forge valid JWT tokens trivially. This applies to **all** secret fields with `#[serde(default)]`:
  - `relayer_private_key` (line 26) — controls the blockchain relayer wallet
  - `paypal_client_secret` (line 30)
  - `alchemy_pay_secret_key` (line 33)
  - `jwt_secret` (line 51)
  - And 8 other secret/key fields
- **Suggested Fix:**
  1. Remove `#[serde(default)]` from all secret fields — make them **required**.
  2. Add startup validation that panics if any critical secret is empty or too short.
  3. Enforce minimum JWT secret length (≥ 32 bytes recommended).
  4. For `relayer_private_key`, validate it's a valid 32-byte hex private key.

---

### FINDING-05: Permissive CORS Allows Any Origin
- **File:** `src/main.rs` (line 33)
- **Severity:** 🔴 CRITICAL
- **Description:** The server uses `actix_cors::Cors::permissive()` which allows **all origins, all methods, all headers, and credentials**. For a payment server handling real money:
  - Any malicious website can make authenticated cross-origin requests to this API.
  - Combined with FINDING-01 (no auth middleware), this is catastrophic.
  - Even with auth middleware, CORS `permissive()` with credentials enables CSRF-style attacks where a malicious site can exfiltrate tokens and make API calls on behalf of a victim.
- **Suggested Fix:**
  1. Replace `Cors::permissive()` with a properly configured CORS policy.
  2. Whitelist only the specific frontend origin(s).
  3. Restrict methods to only those needed (GET, POST).
  4. Restrict headers to only required ones (Authorization, Content-Type).

---

### FINDING-06: Payment Send Endpoint is a No-Op (Stub)
- **File:** `crates/api/src/payment/send.rs` (lines 17–24)
- **Severity:** 🔴 CRITICAL
- **Description:** The payment send handler — the most critical money-movement endpoint — is a **stub that always returns success** without performing any validation, authorization, or actual payment processing:
  - No verification that the authenticated user owns the source wallet.
  - No validation of `to_address` format (could be non-hex, invalid length).
  - No validation of `amount` (could be negative, zero, or astronomically large).
  - No validation of `chain_id` against supported chains.
  - No signature verification (the `signature` field is accepted but never checked).
  - No balance check before submitting.
  - Always returns `{"status": "pending", "paymentId": 0}` — hardcoded payment ID.
- **Suggested Fix:** Implement the full payment flow:
  1. Authenticate the user (JWT extraction).
  2. Validate all input fields (address format, amount bounds, supported chain).
  3. Verify the user's signature over the payment parameters.
  4. Check sufficient balance.
  5. Use atomic DB operations to prevent double-payments.
  6. Return a unique payment ID.

---

### FINDING-07: Registration Has No Input Validation or Deduplication
- **File:** `crates/api/src/account/register.rs` (lines 14–22)
- **Severity:** 🔴 CRITICAL
- **Description:** The registration endpoint accepts any `keyset_hash` without:
  - Validating the format (should be a valid keccak256 hash — 32 bytes hex).
  - Checking for duplicate registrations (same `keyset_hash` can be registered multiple times).
  - Performing any proof-of-ownership (anyone can register any keyset_hash).
  - Actually deploying or interacting with the smart contract factory.
  - The handler just logs and returns success.
- **Suggested Fix:** Implement proper registration:
  1. Validate `keyset_hash` format (64-char hex string).
  2. Check DB for existing registration.
  3. Derive the CREATE2 address and verify it matches expected factory deployment.
  4. Store the registration atomically.

---

### FINDING-08: No Rate Limiting on Any Endpoint
- **File:** `src/main.rs`, `crates/api/src/lib.rs` (entire routing)
- **Severity:** 🟠 HIGH
- **Description:** A `grep` for rate-limit/throttle/brute across the entire codebase returned **zero results**. There is no rate limiting on:
  - Login endpoint → brute-force attacks (though currently auth is broken per FINDING-02).
  - Registration → mass account creation/spam.
  - Payment send → payment flooding.
  - Webhook endpoints → DDoS vector.
  - All other endpoints.
- **Suggested Fix:**
  1. Add `actix-web-ratelimit` or a custom Redis-based rate limiter middleware.
  2. Apply stricter limits on authentication endpoints (e.g., 5 attempts/minute per IP).
  3. Apply moderate limits on payment endpoints.
  4. Consider per-user rate limiting after auth is implemented.

---

### FINDING-09: Refresh Token Manager Has No Revocation Mechanism
- **File:** `crates/api-utils/src/refresh_token_manager.rs` (lines 1–37)
- **Severity:** 🟠 HIGH
- **Description:** The `RefreshTokenManager` uses stateless JWTs for refresh tokens with no server-side tracking. This means:
  - Tokens cannot be revoked (e.g., on password reset, suspicious activity, or user logout).
  - Compromised refresh tokens remain valid until expiry.
  - No token rotation — refresh tokens can be reused infinitely within their TTL.
  - The refresh token uses the **same secret** as access tokens, meaning if one key leaks, all token types are compromised.
- **Suggested Fix:**
  1. Store refresh token IDs (JTI claims) in Redis with TTL.
  2. On each refresh, rotate the token (issue new, invalidate old).
  3. Use a separate secret for refresh tokens.
  4. Implement a token revocation endpoint.

---

### FINDING-10: Price Oracle Has No Caching, Staleness Check, or Manipulation Protection
- **File:** `crates/api-utils/src/price_oracle.rs` (lines 1–48)
- **Severity:** 🟠 HIGH
- **Description:** The `PriceOracle`:
  1. Makes a fresh HTTP request to CoinMarketCap on every call with no caching → expensive, slow, and vulnerable to API rate limits.
  2. Uses `unwrap_or(0.0)` when parsing price (line 28) — if the API returns unexpected data, the price defaults to `$0.00`. If this zero price is used for payment calculations, users could buy crypto for free.
  3. Has no staleness detection — if the CMC API is down or returning stale data, payments proceed with incorrect prices.
  4. Has no cross-reference with a second oracle (single point of failure).
  5. No bounds checking on returned prices (e.g., a flash crash or API bug returning price of $0.001 for BTC).
- **Suggested Fix:**
  1. Implement Redis-based caching with a TTL (e.g., 30 seconds).
  2. Replace `unwrap_or(0.0)` with error propagation — reject payment if price unavailable.
  3. Add price sanity bounds (e.g., reject if price changed >50% from last known price).
  4. Add a secondary price source for cross-validation.

---

### FINDING-11: Sensitive Data Logged in Plaintext
- **File:** `crates/api/src/account/login.rs` (line 22)
- **File:** `crates/api/src/account/register.rs` (line 22)
- **Severity:** 🟠 HIGH
- **Description:** The login and registration handlers log the user's `keyset_hash` in plaintext:
  ```rust
  tracing::info!("User logged in: keyset_hash={}", body.keyset_hash);
  tracing::info!("Registering smart account for keyset_hash={}", body.keyset_hash);
  ```
  The `keyset_hash` is a security-critical identifier tied to the user's wallet key management. Logging it exposes it to anyone with access to log aggregation systems (ELK, CloudWatch, etc.). Additionally, `PaymentConfig` derives `Debug` (line 3 of config.rs), which means if the config struct is ever debug-printed or logged, all secrets (private keys, API keys, JWT secret) would be exposed.
- **Suggested Fix:**
  1. Use the existing `mask_address()` utility or a similar masking function for keyset hashes in logs.
  2. Remove `Debug` derive from `PaymentConfig`, or implement a custom `Debug` that redacts secrets.
  3. Audit all `tracing::info!` calls to ensure no sensitive data is logged.

---

### FINDING-12: Relayer Client Has No Authentication or TLS Verification
- **File:** `crates/api-utils/src/relayer_client.rs` (lines 1–31)
- **Severity:** 🟠 HIGH
- **Description:** The `RelayerClient` communicates with the wallet-relayer service (which controls fund movement) using plain `reqwest::Client::new()` with:
  - No authentication headers (no API key, no mTLS, no bearer token).
  - No request signing.
  - Default TLS settings (no certificate pinning).
  - If an attacker can intercept or redirect traffic to the relayer (e.g., DNS spoofing in cloud environments), they can inject arbitrary transactions.
- **Suggested Fix:**
  1. Add authentication (API key or mTLS) to relayer communication.
  2. Implement request signing for all relayer API calls.
  3. Consider certificate pinning for the relayer endpoint.
  4. Validate the response structure before using it.

---

### FINDING-13: Calldata Decoder Has Potential Panic on Malformed Input
- **File:** `crates/api-utils/src/parsed_payment/module_guest_execute.rs` (lines 7–24)
- **Severity:** 🟡 MEDIUM
- **Description:** The `decode_execute_calldata()` function:
  1. Checks `calldata.len() < 4 + 32 * 3` (100 bytes) but then accesses `calldata[92..100]` and `calldata[data_offset + 28..data_offset + 36]` without further bounds checking.
  2. The `data_offset` is parsed from user-supplied calldata (`u64::from_be_bytes(calldata[92..100])`) — an attacker could supply a `data_offset` that causes out-of-bounds array access, resulting in a panic.
  3. `data_len` is similarly attacker-controlled and could cause slice overflow at `calldata[data_offset + 36..data_offset + 36 + data_len]`.
- **Suggested Fix:**
  1. Validate `data_offset + 36 + data_len <= calldata.len()` before slicing.
  2. Add explicit bounds checks for all computed offsets.
  3. Use `.get()` with proper error handling instead of direct indexing.

---

### FINDING-14: Fee Calculation Uses Floating-Point Arithmetic
- **File:** `crates/api-utils/src/single_fee_manager.rs` (lines 20–25)
- **File:** `crates/api-utils/src/utils.rs` (line 12)
- **Severity:** 🟡 MEDIUM
- **Description:** Financial calculations use `f64` floating-point:
  - `SingleFeeManager::estimate_fee()` converts `gas_price_gwei * 1e9` using f64, which can lose precision for large values.
  - `wei_to_ether()` parses wei as `f64` — wei values can be up to 10^77 (uint256 max), far exceeding f64 precision (~10^15).
  - These precision errors in a payment system could lead to incorrect fee calculations, potentially causing fund loss.
- **Suggested Fix:**
  1. Use `U256` (from ethers) or `BigDecimal` for all financial calculations.
  2. Remove all `f64` arithmetic from fee/price computation paths.
  3. Keep `f64` only for display purposes, never for calculation.

---

### FINDING-15: Transaction Submitter Has No Idempotency Protection
- **File:** `crates/api-utils/src/payment_manager/payment_submitter/submitter.rs` (lines 3–26)
- **File:** `crates/api-utils/src/transaction_manager/transaction_submitter.rs` (lines 1–15)
- **Severity:** 🟡 MEDIUM
- **Description:** The payment submitter runs in a polling loop (`loop { process_pending(); sleep(500ms); }`). If `process_pending()` queries for pending payments and starts submitting but crashes/restarts before updating the status, the same payment could be submitted again (double-spend). There is no visible:
  - Pessimistic DB lock (`SELECT ... FOR UPDATE`) on pending payments.
  - Redis-based distributed lock.
  - Idempotency key for blockchain transactions.
  - Nonce management to prevent duplicate submissions.
- **Suggested Fix:**
  1. Use `SELECT ... FOR UPDATE SKIP LOCKED` when querying pending payments.
  2. Implement a Redis-based distributed lock per payment ID.
  3. Track and verify nonces to prevent duplicate chain submissions.
  4. Add idempotency checks before submitting to the blockchain.

---

### FINDING-16: Server Binds to 0.0.0.0 by Default
- **File:** `src/main.rs` (line 39)
- **Severity:** 🟡 MEDIUM
- **Description:** The server binds to `0.0.0.0` (all network interfaces), which in containerized/cloud environments may expose the service to unintended networks. Combined with no authentication (FINDING-01), this means anyone on the network can access all endpoints.
- **Suggested Fix:**
  1. Make the bind address configurable via environment variable.
  2. Default to `127.0.0.1` and require explicit opt-in for `0.0.0.0`.
  3. Ensure the service is behind a reverse proxy/load balancer in production.

---

### FINDING-17: Account Recovery Endpoint Has No Implementation
- **File:** `crates/api/src/account/recovery.rs` (lines 3–10)
- **Severity:** 🟡 MEDIUM
- **Description:** The account recovery endpoint always returns `{"status": "recovery_initiated"}` without performing any actual DKIM email verification or keyset rotation. While this is a "stub", exposing it as a functional endpoint is misleading and could be abused:
  - An attacker could claim recovery was initiated, then social-engineer support.
  - No actual security control is enforced.
- **Suggested Fix:** Either implement the full recovery flow or return `501 Not Implemented` until ready.

---

### FINDING-18: PaymentConfig Derives Debug — May Expose Secrets
- **File:** `crates/config/src/config.rs` (line 3)
- **Severity:** 🟢 LOW
- **Description:** `#[derive(Debug, Clone, Deserialize)]` on `PaymentConfig` means calling `format!("{:?}", config)` or `dbg!(config)` anywhere will print all secrets (JWT secret, private keys, API keys) in plaintext.
- **Suggested Fix:** Implement a custom `Debug` trait that redacts sensitive fields, or remove `Debug` derive.

---

### FINDING-19: No TLS/HTTPS Enforcement
- **File:** `src/main.rs` (lines 35–41)
- **Severity:** 🟢 LOW
- **Description:** The Actix-web server uses plain HTTP (`HttpServer::new()` with `.bind()`). While TLS is typically terminated at the load balancer/reverse proxy, the application itself has no enforcement or detection of HTTPS. JWT tokens and API keys transmitted over plain HTTP can be intercepted.
- **Suggested Fix:** Either configure `actix-web` with `rustls`/`openssl` for TLS, or add middleware that enforces `X-Forwarded-Proto: https` header.

---

### FINDING-20: No Input Sanitization on Address/Calldata Query Params
- **File:** `crates/api/src/assets/estimated_fee.rs` (lines 4–5)
- **File:** `crates/api/src/assets/assets_list.rs` (line 10)
- **Severity:** 🟢 LOW
- **Description:** Query parameters like `to` (address) and `data` (calldata) are accepted as raw strings with no validation. While SeaORM's parameterized queries prevent SQL injection, passing unvalidated addresses/calldata to RPC calls could cause unexpected behavior.
- **Suggested Fix:** Validate Ethereum address format (`0x` + 40 hex chars) and calldata format (valid hex) before processing.

---

### FINDING-21: Bridge Validator Client Has No Response Validation
- **File:** `crates/api-utils/src/payment_manager/payment_submitter/bridge_validator_client.rs` (lines 19–35)
- **Severity:** 🟢 LOW
- **Description:** Responses from the bridge-validator service are deserialized without schema validation. A compromised or buggy bridge-validator could return unexpected JSON that causes silent failures (e.g., `unwrap_or("unknown")` on status).
- **Suggested Fix:** Define proper response types and validate response structure.

---

## Summary Table

| ID | Severity | Category | File | Issue |
|----|----------|----------|------|-------|
| 01 | 🔴 CRITICAL | AuthN | `api/src/lib.rs` | No auth middleware on any route |
| 02 | 🔴 CRITICAL | AuthN | `api/src/account/login.rs` | Login skips signature verification |
| 03 | 🔴 CRITICAL | Webhook | `ramp/webhooks/alchemy_pay/*.rs` | No webhook signature verification |
| 04 | 🔴 CRITICAL | Crypto | `config/src/config.rs` | Secrets default to empty strings |
| 05 | 🔴 CRITICAL | CORS | `src/main.rs` | Permissive CORS (all origins) |
| 06 | 🔴 CRITICAL | Payment | `api/src/payment/send.rs` | Payment endpoint is unvalidated stub |
| 07 | 🔴 CRITICAL | AuthN | `api/src/account/register.rs` | Registration has no validation |
| 08 | 🟠 HIGH | DoS | `src/main.rs` | No rate limiting anywhere |
| 09 | 🟠 HIGH | AuthN | `refresh_token_manager.rs` | No token revocation |
| 10 | 🟠 HIGH | Finance | `price_oracle.rs` | Price oracle returns 0.0 on failure |
| 11 | 🟠 HIGH | InfoLeak | `login.rs`, `register.rs` | Sensitive data in logs |
| 12 | 🟠 HIGH | AuthN | `relayer_client.rs` | No relayer authentication |
| 13 | 🟡 MEDIUM | Memory | `module_guest_execute.rs` | OOB panic on malformed calldata |
| 14 | 🟡 MEDIUM | Finance | `single_fee_manager.rs` | Float arithmetic for money |
| 15 | 🟡 MEDIUM | Payment | `submitter.rs` | No idempotency (double-spend risk) |
| 16 | 🟡 MEDIUM | Network | `src/main.rs` | Binds to 0.0.0.0 |
| 17 | 🟡 MEDIUM | AuthN | `account/recovery.rs` | Recovery is a non-functional stub |
| 18 | 🟢 LOW | InfoLeak | `config/src/config.rs` | Debug derive exposes secrets |
| 19 | 🟢 LOW | Network | `src/main.rs` | No TLS enforcement |
| 20 | 🟢 LOW | Input | `estimated_fee.rs` | No input validation on query params |
| 21 | 🟢 LOW | Validation | `bridge_validator_client.rs` | No response schema validation |

---

## Recommendations Priority

### Immediate (Before any deployment):
1. **Implement authentication middleware** (FINDING-01)
2. **Implement login signature verification** (FINDING-02)
3. **Implement webhook signature verification** (FINDING-03)
4. **Make secrets required / validate on startup** (FINDING-04)
5. **Configure restrictive CORS** (FINDING-05)
6. **Implement payment validation** (FINDING-06)

### Short-term (Within 1 sprint):
7. Add rate limiting (FINDING-08)
8. Fix price oracle failure mode (FINDING-10)
9. Add relayer authentication (FINDING-12)
10. Fix calldata decoder bounds (FINDING-13)

### Medium-term:
11. Implement token revocation (FINDING-09)
12. Replace float arithmetic with integer/BigDecimal (FINDING-14)
13. Add idempotency protection (FINDING-15)
14. Sanitize log output (FINDING-11)
