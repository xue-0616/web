# Deep Business Logic Audit — Payment-Server Unaudited Files

**Date:** 2026-04-16
**Scope:** All previously unaudited files in `payment-server/`
**Focus:** Fund loss, payment amount manipulation, double-processing, incorrect routing

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 6 |
| 🟠 HIGH | 12 |
| 🟡 MEDIUM | 10 |
| 🟢 LOW | 3 |
| **Total** | **31** |

---

## 🔴 CRITICAL Bugs (Immediate Fund Risk)

### CRIT-01: PayPal Merchant — Mutable Token Not Thread-Safe, No Auto-Reauthentication
**File:** `crates/api-utils/src/payment_manager/payment_merchant/paypal_merchant/merchant.rs`
**Lines:** `access_token: Option<String>` + `pub async fn authenticate(&mut self)`

`PayPalMerchant` stores the OAuth2 `access_token` as a plain `Option<String>` and `authenticate()` requires `&mut self`. In a concurrent actix-web server:
- Multiple threads sharing this merchant will race on the token field.
- If the token expires (PayPal tokens are typically 9 hours), `create_order()` fails with "not authenticated" — there is **no automatic re-authentication**.
- PayPal order creation silently fails, but the internal system may still debit the user's crypto, causing **fund loss without fiat delivery**.

**Impact:** Users' crypto is deducted but PayPal payment never created → fund loss.
**Fix:** Use `Arc<RwLock<Option<String>>>` for the token, implement automatic re-auth in `create_order()` with token expiry tracking.

---

### CRIT-02: Asset Transaction Handler — Returns "submitted" Without Processing
**File:** `crates/api/src/assets/transaction.rs`

```rust
pub async fn handler(_auth: AuthenticatedUser, body: web::Json<serde_json::Value>) -> HttpResponse {
    tracing::info!("Relaying asset transaction");
    HttpResponse::Ok().json(serde_json::json!({"status": "submitted"}))
}
```

The handler accepts arbitrary JSON, logs it, and returns `{"status": "submitted"}` without actually:
1. Validating the transaction request
2. Parsing the UserOperation
3. Verifying the keyset signature
4. Submitting to the bundler/relayer

**Impact:** Users believe their transaction was submitted when nothing happened. Fund operations silently fail.
**Fix:** Implement full transaction validation, signature verification, and relayer submission before returning success.

---

### CRIT-03: Firebase Push Notifications — Raw Private Key as Bearer Token
**File:** `crates/api-utils/src/firebase_manager.rs`

```rust
.bearer_auth(&self.private_key)
```

FCM v1 API (`fcm.googleapis.com/v1/...`) requires a **JWT access token** obtained via Google OAuth2 service account flow, NOT the raw private key string. This means:
- **All push notifications fail** with HTTP 401.
- Users never receive payment confirmation/failure notifications.
- Combined with stub handlers, users have no feedback on payment status.

**Impact:** Complete notification blindness — users don't know if payments succeeded or failed.
**Fix:** Implement Google OAuth2 service account JWT flow to obtain access tokens.

---

### CRIT-04: StreamConsumer — References Non-Existent Struct Fields (Won't Compile)
**File:** `crates/app-redis/src/stream/consumer.rs`

```rust
pub async fn read(&self, _pool: &deadpool_redis::Pool, count: usize) -> Result<...> {
    let mut conn = self.pool.get().await?;           // ERROR: self.pool doesn't exist
    let result = redis::cmd("XREADGROUP")
        .arg("COUNT").arg(self.batch_size)            // ERROR: self.batch_size doesn't exist
```

And in `ack()`:
```rust
pub async fn ack(&self, _pool: &deadpool_redis::Pool, _msg_id: &str) -> Result<()> {
    let mut conn = self.pool.get().await?;           // ERROR: self.pool doesn't exist
    redis::cmd("XACK").arg(msg_id)                   // ERROR: msg_id not in scope (_msg_id is)
```

The function parameters are prefixed with `_` (unused) but the body references `self.pool`, `self.batch_size`, and `msg_id` — none of which exist.

**Impact:** Redis stream consumption for payment events is completely broken. Asset migrations and payment events cannot be processed.
**Fix:** Use the function parameters (`_pool` → `pool`, `_msg_id` → `msg_id`) and add `batch_size` to the struct or pass as parameter.

---

### CRIT-05: Account Registration — No DB Storage, No Address Derivation
**File:** `crates/api/src/account/register.rs`

The handler validates the keyset_hash format but then:
1. **Duplicate check is commented out** (Step 3) — same keyset_hash can register unlimited times
2. **CREATE2 address derivation is never executed** — only appears in comments
3. **No DB insert** — the account is never stored
4. Returns success with just the keyset_hash

```rust
// Step 3: commented out duplicate check...
// Step 4: only a log + hardcoded response
Ok(HttpResponse::Ok().json(serde_json::json!({
    "status": "registered",
    "keyset_hash": body.keyset_hash,
})))
```

**Impact:** No accounts are actually created. Subsequent login attempts that query the DB will fail because no record exists. The entire user registration flow is non-functional.
**Fix:** Implement the full registration flow: derive CREATE2 address, store in DB, check for duplicates.

---

### CRIT-06: CREATE2 Address Computation is Incorrect
**File:** `crates/api-utils/src/account_utils.rs`

```rust
let init_code_hash = keccak256(
    &[main_module.as_bytes(), &salt].concat()
);
```

The standard CREATE2 formula is:
`address = keccak256(0xff ++ factory ++ salt ++ keccak256(init_code))[12..]`

Where `init_code` is the **deployment bytecode** (proxy bytecode + constructor args). This code computes `keccak256(main_module_address ++ salt)` which is NOT the init_code_hash. The `main_module` is a 20-byte address, not deployment bytecode.

**Impact:** Computed wallet addresses will NOT match on-chain deployed wallets. Funds sent to the "wrong" address are irretrievable.
**Fix:** Use the actual proxy init code (ERC-1167 minimal proxy or custom proxy bytecode) to compute `init_code_hash`.

---

## 🟠 HIGH Severity Bugs

### HIGH-01: All Merchant API Clients — No HTTP Status Validation
**Files:**
- `payment_merchant/alchemy_pay_merchant/merchant.rs` (`query_order()`)
- `payment_merchant/coins_merchant/merchant.rs` (`create_payout()`)
- `payment_merchant/coins_ph_merchant/merchant.rs` (`create_payout()`)
- `payment_merchant/paypal_merchant/merchant.rs` (`create_order()`)
- `payment_merchant/bitrefill_merchant/merchant.rs` (`create_order()`)
- `wind_manager/client.rs` (`create_off_ramp_order()`, `get_order_status()`)

All these clients call `.send().await?.json().await?` without checking `resp.status()`. When the API returns HTTP 400/401/500, the response body (often an error JSON like `{"error": "..."}`) is blindly deserialized.

**Impact per merchant:**
- **CoinsMerchant/CoinsPhMerchant:** Payout fails silently — user's crypto is locked but fiat never sent
- **AlchemyPay:** Order query fails → system loses track of ramp order state
- **PayPal:** Order creation failure treated as success
- **Bitrefill:** Gift card order fails but system marks as purchased

**Fix:** Check `resp.status().is_success()` before deserializing; return structured errors on failure.

---

### HIGH-02: AlchemyPay query_order — Missing HMAC Signature
**File:** `crates/api-utils/src/payment_manager/payment_merchant/alchemy_pay_merchant/merchant.rs`

```rust
pub async fn query_order(&self, order_no: &str) -> Result<serde_json::Value> {
    let resp = self.client
        .get(...)
        .query(&[("orderNo", order_no)])
        .header("appId", &self.app_id)
        // NOTE: No "sign" header!
        .send().await?
```

`create_on_ramp_order()` includes an HMAC-SHA256 signature header (`sign`), but `query_order()` does not. AlchemyPay's API likely rejects unsigned requests.

**Impact:** Cannot query order status → payment state tracking breaks → potential double-payments or stuck orders.
**Fix:** Add signature to query_order() using the same signing mechanism.

---

### HIGH-03: Duplicate BitrefillMerchant Definitions with Conflicting Auth
**Files:**
- `payment_merchant/bitrefill.rs` — Uses `bearer_auth`, hardcodes `https://api.bitrefill.com/v2`
- `payment_merchant/bitrefill_merchant/merchant.rs` — Uses `basic_auth`, takes configurable `api_url`

Two different structs named `BitrefillMerchant` with different authentication methods:
- One uses **Bearer token** auth
- Other uses **HTTP Basic** auth

**Impact:** Depending on which is imported, Bitrefill API calls use the wrong auth method → orders fail or are rejected.
**Fix:** Remove the duplicate and standardize on one implementation with correct auth (Bitrefill uses API key auth).

---

### HIGH-04: Transaction Submitter — Returns Empty String on RPC Error
**File:** `crates/api-utils/src/transaction_manager/transaction_submitter.rs`

```rust
let hash = resp["result"].as_str().unwrap_or("").to_string();
Ok(hash)
```

If the RPC returns an error (e.g., `{"error": {"code": -32000, "message": "nonce too low"}}`), the `result` field is null/missing, and this returns `Ok("")` — an empty string treated as a **successful** transaction hash.

**Impact:** The caller believes the transaction was submitted. DB records an empty tx_hash as "submitted". The actual transaction was never sent → fund loss.
**Fix:** Check for `resp["error"]` first; return `Err(...)` on RPC error.

---

### HIGH-05: Ramp Handlers Are Non-Functional Stubs
**Files:**
- `crates/api/src/ramp/off_ramp.rs`
- `crates/api/src/ramp/on_ramp.rs`

Both handlers return `{"status": "initiated"}` without performing any actual work:
```rust
pub async fn handler(_auth: AuthenticatedUser, body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "initiated"}))
}
```

**Impact:** Users initiate fiat on/off ramps believing the process started, but no orders are created, no merchant APIs are called, no crypto is locked/released.
**Fix:** Implement full ramp flow: validate request → create DB order → call merchant API → return order details.

---

### HIGH-06: Chain Events — Log-Only, No State Changes
**File:** `crates/api-utils/src/chain_events/events.rs`

```rust
pub async fn handle_event(event: &ChainEvent) -> anyhow::Result<()> {
    match event {
        ChainEvent::TransactionConfirmed { tx_hash, .. } => {
            tracing::info!("Payment confirmed: tx_hash={}", tx_hash);
        }
        // ... only logging, no DB updates
    }
    Ok(())
}
```

On-chain events (confirmations, failures, bridge completions) are logged but:
- No payment status updated in DB
- No refund flow triggered on failure
- No user notifications sent

**Impact:** Payments that confirm on-chain are never marked as complete. Failed transactions are never refunded. Users see permanent "pending" status.
**Fix:** Implement DB updates and trigger notification/refund flows for each event type.

---

### HIGH-07: Payment Router — Incomplete Country Validation for Off-Ramp
**File:** `crates/api-utils/src/payment_router/router.rs`

```rust
"off_ramp" if country == "PH" => Ok(PaymentRoute::Coins),
"off_ramp" => Ok(PaymentRoute::Wind),
```

- No validation that `country` is a valid ISO 3166-1 alpha-2 code
- **All** non-PH off-ramps route to Wind regardless of whether Wind supports that country
- No checking if the merchant is active/available

**Impact:** Off-ramp to unsupported countries silently routes to Wind which will reject → user's crypto is locked but fiat is never delivered.
**Fix:** Validate country code, check Wind's supported country list, return clear error for unsupported regions.

---

### HIGH-08: Monitor Transactions Manager — Stub Implementation
**File:** `crates/api-utils/src/monitor_transactions_manager.rs`

The background task that should monitor pending transactions for on-chain confirmation is a stub:
```rust
async fn check_pending(ctx: &PaymentContext) -> anyhow::Result<()> {
    tracing::info!("Monitoring pending transactions");
    Ok(())
}
```

No actual transaction receipts are queried, no status updates occur.

**Impact:** Submitted transactions are never confirmed or marked as failed. Combined with HIGH-06, the entire payment lifecycle tracking after submission is non-functional.
**Fix:** Implement actual `eth_getTransactionReceipt` polling and status updates.

---

### HIGH-09: PaymentNotifier — Errors Silently Swallowed
**File:** `crates/api-utils/src/payment_manager/notifier.rs`

```rust
let _ = client.post("https://api.sendgrid.com/v3/mail/send")
    .bearer_auth(api_key)
    .json(&email_body)
    .send().await;
// ...
let _ = client.post(webhook_url)
    .json(&...)
    .send().await;
```

Both notification calls use `let _ =` which discards the Result. Failed emails and Slack messages are never:
- Logged
- Retried
- Reported

**Impact:** Users and operators get no notification of payment events. Critical payment failures go unnoticed.
**Fix:** Log errors, implement retry logic, or at minimum use `if let Err(e) = ... { tracing::error!(...) }`.

---

### HIGH-10: Rate Limiters Defined But Never Applied
**File:** `crates/api/src/rate_limiter.rs` (definition) vs `crates/api/src/lib.rs` (routes)

`RateLimiters` is fully implemented with per-category limits (login: 5/min, registration: 3/min, payment: 10/min), but `configure_routes()` in `lib.rs` never instantiates or applies them.

**Impact:** All endpoints are unprotected against brute force. Critical impacts:
- Login endpoint: unlimited password/signature guessing
- Payment endpoint: unlimited transaction spam
- Registration: unlimited account creation

**Fix:** Integrate rate limiters as actix middleware or guards in route configuration.

---

### HIGH-11: Merchants Registry Missing CoinsPhMerchant and WindMerchant
**File:** `crates/api-utils/src/payment_manager/payment_merchant/merchants.rs`

```rust
pub use super::alchemy_pay_merchant::merchant::AlchemyPayMerchant;
pub use super::paypal_merchant::merchant::PayPalMerchant;
pub use super::bitrefill_merchant::merchant::BitrefillMerchant;
pub use super::coins_merchant::merchant::CoinsMerchant;
// Missing: CoinsPhMerchant, WindMerchant
```

**Impact:** Code importing from `merchants` won't have access to Philippines (CoinsPhMerchant) or Wind off-ramp merchants. Routing to these merchants will fail at compile time or runtime.
**Fix:** Add the missing re-exports.

---

### HIGH-12: Asset Migration Consumer — No Actual Processing
**File:** `crates/api-utils/src/asset_migrator/transaction_consumer.rs`

```rust
pub async fn consume_migrations(redis: &deadpool_redis::Pool) -> Result<Vec<serde_json::Value>> {
    // ... XREADGROUP ...
    Ok(Vec::new())  // Always returns empty!
}

pub async fn process_migration(_tx_data: &serde_json::Value) -> Result<()> {
    tracing::info!("Processing asset migration");
    Ok(())  // No actual processing
}
```

- `consume_migrations()` reads from Redis but always returns `Vec::new()` ignoring the result
- `process_migration()` is a no-op stub

**Impact:** Cross-chain asset migrations are never processed. Assets locked on source chain are never released on destination chain → permanent fund lock.
**Fix:** Parse the XREADGROUP response, implement the actual lock/burn → mint/unlock migration flow.

---

## 🟡 MEDIUM Severity Bugs

### MED-01: Fee Calculation — Potential Integer Overflow
**File:** `crates/api-utils/src/payment_router/routing.rs`

```rust
let base_fee = amount * base_fee_bps / 10000;
```

For `u64`: if `amount > u64::MAX / 200 ≈ 9.2 × 10^16`, the multiplication overflows (in debug mode = panic, in release = wrap to wrong value). With 18-decimal tokens, this is ~92 ETH worth of wei — easily reachable.

**Impact:** Fee calculation wraps to incorrect value → user charged wrong fee.
**Fix:** Use `u128` arithmetic: `(amount as u128 * base_fee_bps as u128 / 10000) as u64` or use `checked_mul`.

---

### MED-02: Hardcoded Network Fee
**File:** `crates/api-utils/src/payment_router/routing.rs`

```rust
let network_fee = 5000; // flat 5000 wei equiv
```

A flat 5000 wei (~$0.000000000000005) regardless of chain or gas conditions is economically meaningless and won't cover any actual network costs.

**Impact:** Users are undercharged for network fees → platform absorbs all gas costs.
**Fix:** Integrate with `SingleFeeManager` or `GasEstimator` to calculate real-time network fees.

---

### MED-03: Payment Details — No Authorization Scoping
**File:** `crates/api/src/payment/details.rs`

```rust
pub async fn handler(_auth: AuthenticatedUser, query: web::Query<HashMap<String, String>>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"payment": null}))
}
```

The `AuthenticatedUser` is extracted but not used to scope the query. When implemented, if it doesn't filter by `_auth.user_id`, any user can view any payment's details.

**Impact:** Payment information disclosure between users (amounts, addresses, status).
**Fix:** Use `_auth.user_id` to filter payment queries to only the authenticated user's payments.

---

### MED-04: Login Message Replay Within Window
**File:** `crates/api/src/account/login.rs`

The timestamp validation allows a 300-second (5-minute) window. Within this window, the same signed message can be replayed:
- No nonce in the message
- No single-use tracking of signed messages

**Impact:** If an attacker captures a login signature (e.g., via compromised HTTPS), they can replay it within 5 minutes.
**Fix:** Add a random nonce to the message and track used nonces in Redis with 5-minute TTL.

---

### MED-05: PriceOracle — Stale Price Fallback Missing
**File:** `crates/api-utils/src/price_oracle.rs`

When the CMC API is down:
1. Cache has a 30-second TTL
2. After 30 seconds, the next request hits the API
3. If API fails, `get_price()` returns an error
4. There is no fallback to the last known price

**Impact:** Temporary API outages cause all price-dependent operations (fee estimation, ramp quotes) to fail entirely.
**Fix:** Fall back to the last cached price (even if expired) with a warning, rather than failing completely.

---

### MED-06: WindMerchant — Unvalidated JSON Pass-through
**File:** `crates/api-utils/src/payment_manager/payment_merchant/wind_merchant/merchant.rs`

```rust
pub async fn process_off_ramp(&self, params: &serde_json::Value) -> anyhow::Result<serde_json::Value> {
    self.client.create_off_ramp_order(params).await
}
```

Raw `serde_json::Value` is forwarded to the Wind API without validation of required fields (amount, currency, recipient).

**Impact:** Malformed requests to Wind API → unpredictable behavior, potential fund loss if amount field is missing/malformed.
**Fix:** Define a typed request struct with proper validation before forwarding.

---

### MED-07: Notification History — Returns Empty Array Always
**File:** `crates/api/src/history/notify_history.rs`

```rust
pub async fn handler(_auth: AuthenticatedUser, query: ...) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"notifications": []}))
}
```

**Impact:** Users can never see their notification history. Combined with broken push notifications (CRIT-03), users have zero visibility into payment events.
**Fix:** Implement DB query filtered by authenticated user_id.

---

### MED-08: Invoice Email Template — HTML Injection
**File:** `crates/api-utils/src/invoice_manager/send_grid_manager/invoice_template.rs`

```rust
"<h2>Payment Confirmed</h2><p>Amount: {} {}</p><p>TX: {}</p>",
amount, currency, tx_hash
```

Parameters are interpolated directly into HTML without escaping. If `amount`, `currency`, or `tx_hash` contain HTML/JS, they'll be rendered.

**Impact:** If attacker-controlled data reaches these fields, it enables email phishing via XSS in the payment receipt email.
**Fix:** HTML-escape all interpolated values using `html_escape` crate or equivalent.

---

### MED-09: DAO Models — Amount Stored as String Without Validation
**Files:** All DAO models storing financial amounts: `payment.rs`, `alchemy_pay_*.rs`, `coins_off_ramp_orders.rs`, `paypal_orders.rs`, `wind_off_ramp_order.rs`, `on_ramp_order.rs`, `payment_output.rs`

All amount fields are `String` type:
```rust
pub amount: String,
pub fiat_amount: Option<String>,
pub crypto_amount: Option<String>,
```

No validation at the DAO level ensures these are valid numeric values. Negative amounts, extremely large values, or non-numeric strings could be stored.

**Impact:** Fund accounting integrity — garbage data in amount fields can corrupt payment state, cause incorrect refunds, or bypass amount limits.
**Fix:** Add validation via a `NewType` wrapper (e.g., `ValidAmount(String)`) that enforces numeric, positive, reasonable-range values on insert.

---

### MED-10: TLS Middleware — Environment Variable Determines Security
**File:** `crates/api/src/tls_middleware.rs`

```rust
let is_production = std::env::var("ENVIRONMENT")
    .map(|e| e.eq_ignore_ascii_case("production") || e.eq_ignore_ascii_case("prod"))
    .unwrap_or(false);
```

If `ENVIRONMENT` is not set (common misconfiguration), HTTPS enforcement is **disabled**. The default is insecure.

**Impact:** Misconfigured production deployments silently serve over HTTP, exposing JWT tokens and payment data in transit.
**Fix:** Default to requiring HTTPS if `ENVIRONMENT` is not set (fail-secure).

---

## 🟢 LOW Severity Issues

### LOW-01: Config API Exposes Hardcoded Chain/Token List
**File:** `crates/api/src/config_api.rs`

```rust
HttpResponse::Ok().json(serde_json::json!({
    "supportedChains": [42161, 137, 56],
    "feeTokens": ["ETH", "USDC", "USDT"],
}))
```

Hardcoded values that should come from DB/config. Not a security issue but causes operational rigidity.

---

### LOW-02: mask_address Duplicate Implementation
**Files:** `crates/common/src/lib.rs` AND `crates/api-utils/src/utils.rs`

Both implement identical `mask_address()` functions. The `common` crate version is used across the project, making the `api-utils` one redundant.

---

### LOW-03: Referral Endpoints Are Stubs
**Files:** `crates/api/src/referral/invitation_statistics.rs`, `referral/submit_invitation_code.rs`

Both return hardcoded responses. No financial impact but affects user experience.

---

## Files Audited (Complete List)

### Payment Merchants (6 merchants × ~2 files each)
- ✅ `payment_merchant/alchemy_pay_merchant/merchant.rs` — CRIT bugs
- ✅ `payment_merchant/bitrefill_merchant/merchant.rs` — Duplicate, auth conflict
- ✅ `payment_merchant/bitrefill.rs` — Duplicate definition
- ✅ `payment_merchant/coins_merchant/merchant.rs` — No response validation
- ✅ `payment_merchant/coins_ph_merchant/merchant.rs` — No response validation
- ✅ `payment_merchant/coins_ph_merchant/pending_order.rs` — Data struct only
- ✅ `payment_merchant/paypal_merchant/merchant.rs` — Thread-safety, no re-auth
- ✅ `payment_merchant/wind_merchant/merchant.rs` — Unvalidated pass-through
- ✅ `payment_merchant/wind_merchant/pending_wind_order.rs` — Data struct only
- ✅ `payment_merchant/merchants.rs` — Incomplete registry
- ✅ `payment_merchant/mod.rs`

### Payment Router
- ✅ `payment_router/router.rs` — Incomplete country routing
- ✅ `payment_router/routing.rs` — Integer overflow, hardcoded fee

### Payment Manager
- ✅ `payment_manager/manager.rs` — Empty stub
- ✅ `payment_manager/notifier.rs` — Silent error swallowing
- ✅ `payment_manager/mod.rs`
- ✅ `payment_manager/payment_submitter/submitter.rs` — Previously audited, well-fixed
- ✅ `payment_manager/payment_submitter/bridge_validator_client.rs` — Good validation
- ✅ `payment_manager/payment_submitter/recording_payment.rs` — Data struct
- ✅ `payment_manager/payment_submitter/recording_payments.rs` — Data struct
- ✅ `payment_manager/payment_submitter/pending_payment.rs` — Data struct
- ✅ `payment_manager/payment_submitter/pending_payments.rs` — Data struct

### Ramp Handlers
- ✅ `ramp/on_ramp.rs` — Stub, non-functional
- ✅ `ramp/off_ramp.rs` — Stub, non-functional
- ✅ `ramp/mod.rs`

### Account
- ✅ `account/register.rs` — No DB storage, no address derivation
- ✅ `account/login.rs` — Good EIP-191 verification, replay risk in window
- ✅ `account/recovery.rs` — Returns 501, intentionally unimplemented
- ✅ `account/update_backup.rs` — Stub but auth-protected

### History
- ✅ `history/notify_history.rs` — Returns empty always

### Chain Events
- ✅ `chain_events/events.rs` — Log-only, no state changes
- ✅ `chain_events/mod.rs`

### Smart Account Wallet
- ✅ `smart-account-wallet/src/lib.rs` — Module exports
- ✅ `smart-account-wallet/src/key/mod.rs` — Module exports
- ✅ `smart-account-wallet/src/signer/mod.rs` — Module exports

### Invoice/Asset Managers
- ✅ `invoice_manager/manager.rs` — Stub
- ✅ `invoice_manager/paypal_manager/client.rs` — Stub
- ✅ `invoice_manager/paypal_manager/manager.rs` — Stub
- ✅ `invoice_manager/send_grid_manager/manager.rs` — Stub
- ✅ `invoice_manager/send_grid_manager/client.rs` — Stub
- ✅ `invoice_manager/send_grid_manager/invoice_template.rs` — HTML injection
- ✅ `asset_migrator/manager.rs` — Stub
- ✅ `asset_migrator/transaction_consumer.rs` — Returns empty, no-op processing
- ✅ `asset_migrator/transaction_consumer_item.rs` — Data struct
- ✅ `asset_migrator/client.rs` — Stub

### DAOs (all 28 files)
- ✅ `daos/src/lib.rs` — Module exports
- ✅ `daos/src/payment.rs` — Amount as String
- ✅ `daos/src/accounts.rs` — Includes find_by_keyset_hash
- ✅ `daos/src/alchemy_pay_off_ramp_orders.rs` — Schema
- ✅ `daos/src/alchemy_pay_on_ramp_orders.rs` — Schema
- ✅ `daos/src/coins_off_ramp_orders.rs` — Schema
- ✅ `daos/src/paypal_orders.rs` — Schema
- ✅ `daos/src/wind_off_ramp_order.rs` — Schema
- ✅ `daos/src/wind_accounts.rs` — Schema
- ✅ `daos/src/user_wind_accounts.rs` — Schema
- ✅ `daos/src/payment_merchants.rs` — Schema
- ✅ `daos/src/payment_output.rs` — Schema
- ✅ `daos/src/payment_relayer_tx.rs` — Schema
- ✅ `daos/src/submitter_transaction.rs` — Schema
- ✅ `daos/src/relayer_sub_transaction.rs` — Schema
- ✅ `daos/src/bitrefill_shopping_order.rs` — Schema
- ✅ `daos/src/on_ramp_order.rs` — Schema
- ✅ `daos/src/off_ramp_fiat_currencies.rs` — Schema
- ✅ `daos/src/invoices.rs` — Has expiry check, good
- ✅ `daos/src/keyset_info.rs` — Schema
- ✅ `daos/src/master_keystore.rs` — Schema
- ✅ `daos/src/transaction_history.rs` — Schema
- ✅ `daos/src/receive_transaction.rs` — Schema
- ✅ `daos/src/config.rs` — Schema
- ✅ `daos/src/coins_beneficiary_bank.rs` — Schema
- ✅ `daos/src/notify_history.rs` — Schema
- ✅ `daos/src/user_backup.rs` — Schema
- ✅ `daos/src/user_device_info.rs` — Schema
- ✅ `daos/src/app_version.rs` — Schema
- ✅ `daos/src/asset_migrator_transaction.rs` — Schema
- ✅ `daos/src/user_asset_migrator_account.rs` — Schema

### Additional Files Audited
- ✅ `api-utils/src/relayer_client.rs` — Good HMAC signing
- ✅ `api-utils/src/price_oracle.rs` — Good sanity checks, f64 precision noted
- ✅ `api-utils/src/single_fee_manager.rs` — Good U256 arithmetic
- ✅ `api-utils/src/account_utils.rs` — CREATE2 computation wrong
- ✅ `api-utils/src/utils.rs` — Good wei conversion
- ✅ `api-utils/src/monitor_transactions_manager.rs` — Stub
- ✅ `api-utils/src/activity_manager.rs` — Stub
- ✅ `api-utils/src/firebase_manager.rs` — Wrong auth
- ✅ `api-utils/src/refresh_token_manager.rs` — Good atomic rotation
- ✅ `api-utils/src/oauth_manager.rs` — Stub
- ✅ `api-utils/src/fee_quota_manager.rs` — Stub
- ✅ `api-utils/src/on_off_ramp_manager.rs` — Stub
- ✅ `api-utils/src/parsed_payment/module_guest_execute.rs` — Good bounds checking
- ✅ `api-utils/src/parsed_payment/types.rs` — Data struct
- ✅ `api-utils/src/transaction_manager/manager.rs` — Basic
- ✅ `api-utils/src/transaction_manager/transaction_submitter.rs` — Empty hash bug
- ✅ `api-utils/src/transaction_manager/transaction_submitters.rs` — Registry
- ✅ `api-utils/src/transaction_manager/pending_transaction.rs` — Data struct
- ✅ `api-utils/src/alchemy_pay_manager/*.rs` — Stubs + signing
- ✅ `api-utils/src/coins_ph_manager/*.rs` — Stubs
- ✅ `api-utils/src/wind_manager/*.rs` — Basic client
- ✅ `common/src/lib.rs` — Utility
- ✅ `common/src/crypto.rs` — Good constant-time HMAC
- ✅ `common/src/auth.rs` — Standard JWT
- ✅ `common/src/payment.rs` — Enums
- ✅ `config/src/config.rs` — Good validation + redaction
- ✅ `config/src/apollo_client.rs` — Stub
- ✅ `config/src/lib.rs`
- ✅ `custom-auth-core/src/lib.rs`, `constants.rs` — Constants
- ✅ `logger/src/slack_webhook_writer.rs` — Simple
- ✅ `logger/src/lib.rs`
- ✅ `app-redis/src/lib.rs`, `stream/consumer.rs` — Broken
- ✅ `payment-contracts/src/*.rs` — All ABI bindings
- ✅ `api/src/lib.rs` — Route config
- ✅ `api/src/context.rs` — Clean
- ✅ `api/src/auth_middleware.rs` — Good JWT extraction
- ✅ `api/src/rate_limiter.rs` — Good implementation, not applied
- ✅ `api/src/tls_middleware.rs` — Insecure default
- ✅ `api/src/config_api.rs` — Hardcoded
- ✅ `api/src/assets/*.rs` — Stubs with good validation
- ✅ `api/src/referral/*.rs` — Stubs
- ✅ `src/main.rs` — Entry point, good structure

---

## Positive Findings (Previously Fixed Issues Working Well)

1. **submitter.rs** — Excellent distributed locking with UUID ownership, per-payment transactions, proper BUG-2/3/12 fixes
2. **bridge_validator_client.rs** — Good response validation with VALID_STATUSES whitelist
3. **relayer_client.rs** — Proper HMAC-SHA256 request signing
4. **price_oracle.rs** — Good sanity checking with 50% deviation limit
5. **single_fee_manager.rs** — Correct U256 integer arithmetic (no f64)
6. **module_guest_execute.rs** — Thorough bounds-checked ABI decoding
7. **refresh_token_manager.rs** — Atomic Lua-based token rotation preventing replay
8. **config.rs** — Proper secret validation on startup, Debug redaction
9. **crypto.rs** — Constant-time HMAC comparison
10. **login.rs** — Proper EIP-191 signature verification with timestamp validation
