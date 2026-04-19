# Payment-Server Business Logic Audit Report

**Date**: 2026-04-15  
**Scope**: Core business logic — fund loss, double-spend, replay attacks  
**Status**: 19 bugs found (4 CRITICAL, 7 HIGH, 5 MEDIUM, 3 LOW)

---

## BUG-1 ⛔ CRITICAL — No Nonce / Replay Protection in Payment Send

**File**: `crates/api/src/payment/send.rs`  
**Impact**: Unlimited replay of signed payment requests → fund drain

The `SendPaymentRequest` struct has **no nonce field**. The code comment mentions "nonce = current Unix timestamp (included in the signed message for uniqueness)" but:
- No nonce field exists in the request struct
- No nonce is included in the ABI encoding that's signed
- No nonce is stored or checked against the database
- The `submitter_transactions` INSERT has no uniqueness constraint on (signature) or (to, amount, chain_id)

**Attack**: An attacker (or MITM) capturing one valid signed request can replay it N times. Each replay creates a new `submitter_transactions` row with status='pending' that the background submitter will pick up and execute on-chain. One captured signature → N withdrawals.

```rust
// ABI-encoded data that gets signed — NO nonce included:
// to_address (32 bytes) + amount (32 bytes) + chain_id (32 bytes)
// Missing: nonce, timestamp, or any replay-prevention field
```

**Fix**: Add a monotonically increasing `nonce` field to the request. Include it in the signed message. Store and check it in the DB (reject if nonce ≤ last used nonce for that user).

---

## BUG-2 ⛔ CRITICAL — Transaction Submitter Double-Spend on Commit Failure

**File**: `crates/api-utils/src/payment_manager/payment_submitter/submitter.rs`  
**Impact**: Same payment submitted to chain multiple times → double-spend

The submitter wraps the entire batch in ONE DB transaction:
1. `BEGIN` transaction
2. `SELECT ... FOR UPDATE SKIP LOCKED` pending payments
3. For each payment: Redis lock → **submit to relayer** (irreversible) → UPDATE status in DB
4. Release Redis lock
5. `COMMIT` transaction

If step 5 (`COMMIT`) fails (network issue, DB timeout), **all UPDATEs roll back** but the relayer submissions (step 3) already happened and cannot be undone. On the next tick:
- The Redis locks were already released (step 4)
- The DB still shows status='pending' (rolled back)
- The same payments get submitted AGAIN → **double-spend**

**Fix**: Use individual DB transactions per payment, or update status to 'submitting' BEFORE calling the relayer (with its own committed transaction), then update to 'submitted' after. Use the tx_hash as a deduplication key.

---

## BUG-3 ⛔ CRITICAL — Redis Lock Released Before DB Commit

**File**: `crates/api-utils/src/payment_manager/payment_submitter/submitter.rs` (line ~108)  
**Impact**: Concurrent double-processing of same payment

`release_lock()` is called inside the for-loop but `txn.commit()` happens after the loop. Timeline:

```
Instance A: locks payment #5, submits, releases lock ← DB not committed yet
Instance B: locks payment #5 (lock is free!), submits AGAIN
Instance A: commits DB (updates payment #5 to 'submitted')
Instance B: also tries to update payment #5 → conflict or second submission
```

This is a race condition window between lock release and DB commit that allows two instances to process the same payment concurrently.

**Fix**: Move `release_lock()` to after `txn.commit()`, or use per-payment DB transactions that commit before lock release.

---

## BUG-4 ⛔ CRITICAL — Smart Account key_hash() Returns All Zeros

**File**: `crates/smart-account-wallet/src/key/open_id_with_email_key.rs`  
**Impact**: All OpenID keys produce identical hashes → key collision / impersonation

```rust
pub fn key_hash(&self) -> [u8; 32] {
    use tiny_keccak::{Keccak, Hasher};
    let mut keccak = Keccak::v256();
    keccak.update(&[0x00, 0x00, 0x00, 0x03]);
    keccak.update(&self.email_hash);
    keccak.update(&self.pepper);
    keccak.update(&self.issuer_hash);  // ← BUG: field doesn't exist (struct has `issuer: String`)
    let mut output = [0u8; 32];
    keccak.finalize(&mut output);
    [0u8; 32]  // ← BUG: returns hardcoded zeros, ignoring computed `output`
}
```

Two bugs:
1. References `self.issuer_hash` which doesn't exist on the struct (compile error)
2. Returns `[0u8; 32]` instead of `output` — all keys hash to the same value

If this code compiles (perhaps via a trait or macro not shown), every user's key hash = 0x000...000 → any user's keyset is interchangeable.

**Fix**: Return `output` and compute `issuer_hash` from `self.issuer`.

---

## BUG-5 🔴 HIGH — No Balance Verification in Payment Send

**File**: `crates/api/src/payment/send.rs`  
**Impact**: Users can submit payments exceeding their balance

`validate_amount()` checks the amount is a positive u128 and within a hardcoded upper bound (~1e30 wei), but does NOT verify the user has sufficient balance. No on-chain `balanceOf` query or internal ledger check. A user with 0 balance can submit payments for any amount, which:
- Creates pending DB records that the submitter processes
- Wastes relayer gas when the on-chain transaction reverts
- Could cause gas drainage attacks against the relayer wallet

**Fix**: Query the user's on-chain balance (or internal ledger) before accepting the payment.

---

## BUG-6 🔴 HIGH — Signed Message Doesn't Include Token Address

**File**: `crates/api/src/payment/send.rs`  
**Impact**: Signature can be reused across different tokens

The ABI-encoded signed message includes `to_address + amount + chain_id` but NOT `token_address`. An attacker who captures a valid signature for a USDC transfer could change `token_address` to a different (cheaper or worthless) token and the signature would still verify.

```rust
// Signed data: to_address || amount || chain_id
// NOT signed: token_address, fee_token
```

**Fix**: Include `token_address` in the ABI encoding that gets signed.

---

## BUG-7 🔴 HIGH — Webhook Handlers Have No Idempotency Protection

**Files**: `crates/api/src/ramp/webhooks/alchemy_pay/on_ramp_webhook.rs`, `off_ramp_webhook.rs`  
**Impact**: Duplicate crypto deliveries on webhook replay

Neither webhook handler checks for duplicate webhook processing. The handlers:
- Don't query if the order has already been processed
- Don't store a webhook event ID for deduplication  
- Don't check the current order status before processing

The on-ramp webhook has `// TODO: Update order status in DB` — it doesn't actually DO anything yet. When implemented without idempotency, replayed webhooks within the 5-minute timestamp window (BUG-10) would trigger multiple crypto deliveries for a single fiat payment.

**Fix**: Check order status before processing. Use the webhook event ID (or order_no) as an idempotency key. Only process webhooks when order is in the expected state.

---

## BUG-8 🔴 HIGH — Webhook Amount Not Verified Against Original Order

**Files**: `crates/api/src/ramp/webhooks/alchemy_pay/on_ramp_webhook.rs`, `off_ramp_webhook.rs`  
**Impact**: Attacker with webhook signing key can claim arbitrary amounts

The webhook handlers verify the HMAC signature but don't validate the payload amounts against the original order stored in the database. If AlchemyPay's signing key is compromised, an attacker could send webhooks with inflated crypto amounts.

**Fix**: After HMAC verification, look up the original order by order_no and verify the amount matches.

---

## BUG-9 🔴 HIGH — Invoice Creation Has Zero Validation

**File**: `crates/api/src/invoice/create_invoice.rs`  
**Impact**: Negative amount invoices, invalid data accepted

The handler accepts raw `serde_json::Value` with NO validation:
- No amount validation (negative, zero, or absurdly large amounts accepted)
- No currency validation
- No recipient email validation
- No duplicate check
- **The handler doesn't actually create anything** — it returns `{"status": "created"}` without touching the DB

```rust
pub async fn handler(_auth: AuthenticatedUser, body: web::Json<serde_json::Value>) -> HttpResponse {
    // ... no validation, no DB interaction ...
    HttpResponse::Ok().json(serde_json::json!({"status": "created"}))
}
```

**Fix**: Define a proper request struct with typed fields. Validate amount > 0, valid currency, valid email. Actually create the invoice in the database.

---

## BUG-10 🔴 HIGH — Asset Transaction Handler Has Zero Validation

**File**: `crates/api/src/assets/transaction.rs`  
**Impact**: Unvalidated transaction relay → potential fund loss

Same pattern as invoice creation — accepts raw JSON, logs a message, returns OK without doing any validation or actual work. When the TODO is implemented, the lack of validation framework means:
- No amount/value validation (negative, overflow)
- No calldata validation  
- No signature verification
- No rate limiting

**Fix**: Define proper request struct, validate all fields, verify signatures.

---

## BUG-11 🔴 HIGH — Referral Self-Application Not Prevented

**File**: `crates/api/src/referral/submit_invitation_code.rs`  
**Impact**: Users can earn referral rewards from themselves

The handler is a stub that accepts any JSON and returns OK. No logic prevents:
- Self-referral (user submitting their own invitation code)
- Duplicate submissions (user submitting multiple codes)
- Invalid codes

**Fix**: Implement proper validation: check code ownership ≠ current user, check user hasn't already used a code, verify code exists.

---

## BUG-12 🟡 MEDIUM — Batch Error Propagation Rolls Back Successful Submissions

**File**: `crates/api-utils/src/payment_manager/payment_submitter/submitter.rs`  
**Impact**: Successfully submitted payments get their DB status rolled back

The `?` operator on DB updates and lock releases means if ANY payment in the batch fails, `process_pending()` returns `Err` and the DB transaction is rolled back. This undoes the status updates for payments that were ALREADY successfully submitted to the relayer, making them eligible for re-submission (amplifying BUG-2).

**Fix**: Handle errors per-payment within the loop (log and continue) rather than propagating up.

---

## BUG-13 🟡 MEDIUM — Webhook Timestamp Replay Window (5 minutes)

**Files**: `crates/api/src/ramp/webhooks/alchemy_pay/on_ramp_webhook.rs`, `off_ramp_webhook.rs`  
**Impact**: Same webhook replayable for 5 minutes

The ±300 second timestamp window allows the exact same webhook (same body, same signature, same timestamp) to be replayed unlimited times within 5 minutes. Combined with no idempotency check (BUG-7), this is exploitable.

**Fix**: Track processed webhook IDs/hashes in Redis with a TTL matching the timestamp window.

---

## BUG-14 🟡 MEDIUM — No Invoice Expiry Mechanism

**File**: `crates/daos/src/invoices.rs`  
**Impact**: Old invoices remain payable forever

The invoice DAO model has no `expires_at` field. There's no mechanism to expire old unpaid invoices. Combined with no duplicate payment check, an invoice could be paid at any time, potentially at a stale exchange rate.

**Fix**: Add `expires_at` to the invoices table. Reject payments on expired invoices.

---

## BUG-15 🟡 MEDIUM — No Invoice Double-Payment Protection

**Files**: `crates/api/src/invoice/`, `crates/daos/src/invoices.rs`  
**Impact**: Same invoice paid twice

The invoice model has a `status` field but there's no logic enforcing state transitions or checking status before accepting payment. An invoice could be paid multiple times.

**Fix**: Check `status != 'paid'` before processing payment. Use DB row locking during payment processing.

---

## BUG-16 🟡 MEDIUM — Shopping Order Has No Amount Validation

**File**: `crates/api/src/shopping/order_create.rs`  
**Impact**: Invalid orders accepted

The Bitrefill order handler accepts raw JSON with no validation of product ID, amount, or currency. It's a stub that returns `{"status": "order_created"}` without creating anything.

**Fix**: Validate product_id against Bitrefill catalog, validate amount > 0, verify user has sufficient balance.

---

## BUG-17 🟢 LOW — Fee Estimation Uses Hardcoded Values

**File**: `crates/api/src/assets/estimated_fee.rs`  
**Impact**: Inaccurate fee estimates

Uses hardcoded `estimated_gas: 200_000` and `gas_price_gwei: 1` instead of querying the chain. Users may approve transactions with insufficient gas, causing failures.

**Fix**: Query actual gas price via `eth_gasPrice` RPC and estimate gas via `eth_estimateGas`.

---

## BUG-18 🟢 LOW — NoSignSigner Produces Zero Signatures

**File**: `crates/smart-account-wallet/src/signer/no_sign_signer.rs`  
**Impact**: Low if only used for estimation; high if accidentally used for real transactions

Returns `Signature { r: 0, s: 0, v: 27 }` for all signing operations. This is documented as intentional for gas estimation, but there's no compile-time or runtime safeguard preventing it from being used in production transaction paths.

**Fix**: Add runtime assertion or log warning when used. Consider making it impossible to construct without an explicit `for_estimation_only()` builder.

---

## BUG-19 🟢 LOW — Price Oracle Uses f64 for Financial Calculations

**File**: `crates/api-utils/src/price_oracle.rs`  
**Impact**: Minor precision loss in price calculations

The price oracle uses `f64` for USD prices. While f64 has ~15 significant digits (sufficient for USD prices), edge cases with very large amounts multiplied by precise prices could lose precision. The `SingleFeeManager` correctly uses U256, but the price oracle feeds f64 values into the system.

**Fix**: Consider using a decimal type (e.g., `rust_decimal::Decimal`) for price values.

---

## Summary Table

| ID | Severity | Component | Issue |
|----|----------|-----------|-------|
| BUG-1 | ⛔ CRITICAL | Payment Send | No nonce/replay protection — unlimited replays |
| BUG-2 | ⛔ CRITICAL | Submitter | Double-spend on DB commit failure |
| BUG-3 | ⛔ CRITICAL | Submitter | Redis lock released before DB commit — race condition |
| BUG-4 | ⛔ CRITICAL | Smart Wallet | key_hash() always returns zeros |
| BUG-5 | 🔴 HIGH | Payment Send | No balance verification |
| BUG-6 | 🔴 HIGH | Payment Send | Token address not in signed message |
| BUG-7 | 🔴 HIGH | Webhooks | No idempotency — duplicate deliveries |
| BUG-8 | 🔴 HIGH | Webhooks | Amount not verified against original order |
| BUG-9 | 🔴 HIGH | Invoice | Zero validation on creation |
| BUG-10 | 🔴 HIGH | Assets | Transaction handler zero validation |
| BUG-11 | 🔴 HIGH | Referral | Self-referral not prevented |
| BUG-12 | 🟡 MEDIUM | Submitter | Batch error rolls back successful submissions |
| BUG-13 | 🟡 MEDIUM | Webhooks | 5-min replay window with no dedup |
| BUG-14 | 🟡 MEDIUM | Invoice | No expiry mechanism |
| BUG-15 | 🟡 MEDIUM | Invoice | No double-payment protection |
| BUG-16 | 🟡 MEDIUM | Shopping | Order amount not validated |
| BUG-17 | 🟢 LOW | Assets | Fee estimation hardcoded |
| BUG-18 | 🟢 LOW | Smart Wallet | NoSignSigner zero sigs (by design, risky) |
| BUG-19 | 🟢 LOW | Price Oracle | f64 precision for financial math |

---

## Priority Recommendations

### Immediate (fund-loss risk):
1. **BUG-1**: Add nonce to payment send — prevents replay attacks
2. **BUG-2 + BUG-3**: Restructure submitter to commit per-payment before releasing lock
3. **BUG-4**: Fix key_hash() — return computed output, fix issuer_hash reference

### High Priority (before production):
4. **BUG-5 + BUG-6**: Add balance check and include token_address in signed message
5. **BUG-7 + BUG-8 + BUG-13**: Add webhook idempotency and amount verification
6. **BUG-9–11, BUG-16**: Implement proper validation on all stub handlers

### Medium Priority:
7. **BUG-12**: Handle submitter errors per-payment, don't propagate
8. **BUG-14 + BUG-15**: Add invoice expiry and double-payment protection
