use actix_web::{web, HttpResponse};
use crate::auth_middleware::AuthenticatedUser;
use crate::context::PaymentContext;
use sea_orm::{ConnectionTrait, Statement, DatabaseBackend, TransactionTrait};
use sha3::{Digest, Keccak256};
use serde::Deserialize;

/// Supported EVM chain IDs
const SUPPORTED_CHAIN_IDS: &[u64] = &[
    1,      // Ethereum mainnet
    42161,  // Arbitrum One
    137,    // Polygon
    56,     // BSC
    10,     // Optimism
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendPaymentRequest {
    pub chain_id: u64,
    pub to_address: String,
    pub token_address: Option<String>,
    pub amount: String,
    pub fee_token: Option<String>,
    pub signature: String,
    /// BUG-1 fix: Monotonically increasing nonce for replay protection.
    /// Must be included in the signed message. Server rejects if nonce <= last used nonce.
    pub nonce: u64,
}

/// Validate Ethereum address format: 0x + 40 hex chars
fn validate_eth_address(addr: &str) -> Result<(), String> {
    let clean = addr.strip_prefix("0x").unwrap_or(addr);
    if clean.len() != 40 {
        return Err(format!("Address must be 40 hex chars (got {})", clean.len()));
    }
    if hex::decode(clean).is_err() {
        return Err("Address contains invalid hex characters".to_string());
    }
    Ok(())
}

/// Validate amount string: must be a positive number within reasonable bounds
fn validate_amount(amount: &str) -> Result<(), String> {
    if amount.is_empty() {
        return Err("Amount must not be empty".to_string());
    }
    // Parse as integer (wei) — must be positive and within u128 range
    let value: u128 = amount.parse().map_err(|_| "Amount must be a valid positive integer (wei)")?;
    if value == 0 {
        return Err("Amount must be greater than zero".to_string());
    }
    // Max ~1e30 wei (~1 trillion ETH) — reasonable upper bound
    if value > 1_000_000_000_000_000_000_000_000_000_000u128 {
        return Err("Amount exceeds maximum allowed value".to_string());
    }
    Ok(())
}

/// POST /api/v1/payment/send
pub async fn handler(
    user: AuthenticatedUser,
    ctx: web::Data<PaymentContext>,
    body: web::Json<SendPaymentRequest>,
) -> actix_web::Result<HttpResponse> {
    let req = body.into_inner();
    let masked_user = common::mask_address(&user.user_id);

    // Step 1: Validate chain_id
    if !SUPPORTED_CHAIN_IDS.contains(&req.chain_id) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Unsupported chain_id",
            "supported": SUPPORTED_CHAIN_IDS,
        })));
    }

    // Step 2: Validate to_address format (valid hex, 20 bytes for EVM)
    if let Err(e) = validate_eth_address(&req.to_address) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid to_address",
            "details": e,
        })));
    }

    // Step 3: Validate optional token_address
    if let Some(ref token_addr) = req.token_address {
        if !token_addr.is_empty() {
            if let Err(e) = validate_eth_address(token_addr) {
                return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Invalid token_address",
                    "details": e,
                })));
            }
        }
    }

    // Step 4: Validate amount
    if let Err(e) = validate_amount(&req.amount) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid amount",
            "details": e,
        })));
    }

    // Step 5: Validate signature is non-empty and well-formed hex (must be 65 bytes = 130 hex chars)
    let clean_sig = req.signature.strip_prefix("0x").unwrap_or(&req.signature);
    let sig_bytes = match hex::decode(clean_sig) {
        Ok(b) if b.len() == 65 => b,
        _ => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid signature: must be 65 bytes (r + s + v) in hex",
            })));
        }
    };

    // BUG-1 fix: Nonce replay protection will be re-validated inside the
    // DB transaction below with a SELECT ... FOR UPDATE, so that two
    // concurrent requests cannot both pass this check (TOCTOU).
    // We still do a cheap pre-check here for fast feedback.
    let db = ctx.db();
    let last_nonce_row = db.query_one(Statement::from_sql_and_values(
        DatabaseBackend::MySql,
        "SELECT MAX(nonce) as max_nonce FROM submitter_transactions WHERE from_address = ?",
        [user.user_id.to_lowercase().into()],
    )).await.map_err(|e| actix_web::error::ErrorInternalServerError(format!("DB query failed: {}", e)))?;

    let last_nonce: u64 = last_nonce_row
        .and_then(|row| row.try_get::<Option<u64>>("", "max_nonce").ok())
        .flatten()
        .unwrap_or(0);

    if req.nonce <= last_nonce {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Nonce too low — possible replay attack",
            "details": format!("Nonce must be > {}, got {}", last_nonce, req.nonce),
        })));
    }

    // Step 6: Verify user's signature over payment params (EIP-191 personal_sign)
    // BUG-1 fix: Message now includes nonce for replay protection
    // BUG-6 fix: Message now includes token_address for cross-token replay protection
    let to_bytes = hex::decode(req.to_address.strip_prefix("0x").unwrap_or(&req.to_address))
        .map_err(|_| actix_web::error::ErrorInternalServerError("to_address decode error"))?;
    let token_bytes = req.token_address.as_ref()
        .map(|a| hex::decode(a.strip_prefix("0x").unwrap_or(a)).unwrap_or_default())
        .unwrap_or_default();

    // ABI-encode: to (bytes20 padded to 32) + amount (uint256) + chain_id (uint64 padded to 32)
    //           + token_address (bytes20 padded to 32) + nonce (uint64 padded to 32)
    let mut abi_encoded = Vec::with_capacity(160);
    // to_address as bytes32 (left-padded)
    let mut to_word = [0u8; 32];
    if to_bytes.len() == 20 {
        to_word[12..32].copy_from_slice(&to_bytes);
    }
    abi_encoded.extend_from_slice(&to_word);
    // amount as uint256 (big-endian, left-padded)
    let amount_val: u128 = req.amount.parse()
        .map_err(|_| actix_web::error::ErrorInternalServerError("amount parse error"))?;
    let mut amount_word = [0u8; 32];
    amount_word[16..32].copy_from_slice(&amount_val.to_be_bytes());
    abi_encoded.extend_from_slice(&amount_word);
    // chain_id as uint256 (big-endian, left-padded)
    let mut chain_word = [0u8; 32];
    chain_word[24..32].copy_from_slice(&req.chain_id.to_be_bytes());
    abi_encoded.extend_from_slice(&chain_word);
    // BUG-6 fix: token_address as bytes32 (left-padded)
    let mut token_word = [0u8; 32];
    if token_bytes.len() == 20 {
        token_word[12..32].copy_from_slice(&token_bytes);
    }
    abi_encoded.extend_from_slice(&token_word);
    // BUG-1 fix: nonce as uint256 (big-endian, left-padded)
    let mut nonce_word = [0u8; 32];
    nonce_word[24..32].copy_from_slice(&req.nonce.to_be_bytes());
    abi_encoded.extend_from_slice(&nonce_word);

    let msg_hash = Keccak256::digest(&abi_encoded);

    // EIP-191 prefix: "\x19Ethereum Signed Message:\n32" + msg_hash
    let mut prefixed = Vec::with_capacity(60);
    prefixed.extend_from_slice(b"\x19Ethereum Signed Message:\n32");
    prefixed.extend_from_slice(&msg_hash);
    let personal_hash = Keccak256::digest(&prefixed);

    // Recover signer from signature
    let v = sig_bytes[64];
    let recovery_id = if v >= 27 { v - 27 } else { v };
    let recid = k256::ecdsa::RecoveryId::from_byte(recovery_id)
        .ok_or_else(|| actix_web::error::ErrorBadRequest("Invalid signature recovery id"))?;
    let ecdsa_sig = k256::ecdsa::Signature::from_bytes(sig_bytes[..64].into())
        .map_err(|_| actix_web::error::ErrorBadRequest("Invalid ECDSA signature"))?;
    let recovered_key = k256::ecdsa::VerifyingKey::recover_from_prehash(
        personal_hash.as_slice(),
        &ecdsa_sig,
        recid,
    ).map_err(|_| actix_web::error::ErrorBadRequest("Signature recovery failed"))?;

    // Derive address from recovered public key
    let pubkey_bytes = recovered_key.to_encoded_point(false);
    let pubkey_hash = Keccak256::digest(&pubkey_bytes.as_bytes()[1..]); // skip 0x04 prefix
    let recovered_addr = format!("0x{}", hex::encode(&pubkey_hash[12..32]));

    // Compare recovered address with authenticated user's address
    if recovered_addr.to_lowercase() != user.user_id.to_lowercase() {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Signature does not match authenticated user",
        })));
    }

    tracing::info!(
        "Payment signature verified: user={}, chain={}, to={}, amount={}",
        masked_user,
        req.chain_id,
        common::mask_address(&req.to_address),
        req.amount,
    );

    // BUG-5 fix: Verify user has sufficient balance before creating the payment.
    // On-chain balance_checker is not wired into PaymentContext, so we cannot
    // authoritatively verify balance here. As a minimum defence against DoS
    // against the relayer (where a user floods the queue with payments they
    // cannot fund), cap the number of simultaneously in-flight payments
    // per (user, chain, token). Successful on-chain execution or final
    // rejection clears the slot.
    const MAX_INFLIGHT_PAYMENTS: i64 = 32;
    let inflight_row = db.query_one(Statement::from_sql_and_values(
        DatabaseBackend::MySql,
        r#"SELECT COUNT(*) as n
           FROM submitter_transactions
           WHERE from_address = ? AND chain_id = ? AND token_address = ?
             AND status IN ('pending', 'submitted')"#,
        [
            user.user_id.to_lowercase().into(),
            req.chain_id.into(),
            if token_bytes.is_empty() { String::new() } else { hex::encode(&token_bytes) }.into(),
        ],
    )).await.map_err(|e| actix_web::error::ErrorInternalServerError(format!("DB query failed: {}", e)))?;

    let inflight: i64 = inflight_row
        .and_then(|row| row.try_get::<i64>("", "n").ok())
        .unwrap_or(0);

    if inflight >= MAX_INFLIGHT_PAYMENTS {
        return Ok(HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Too many in-flight payments; wait for previous ones to settle",
            "inflight": inflight,
            "limit": MAX_INFLIGHT_PAYMENTS,
        })));
    }

    // Step 7: Insert into DB within a transaction for atomicity.
    let txn = db.begin().await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("DB transaction begin failed: {}", e)))?;

    // BUG-1 fix (authoritative): re-check the max nonce under a row lock to
    // prevent the TOCTOU window between the pre-check above and the INSERT.
    // Without this, two concurrent requests with the same nonce both see
    // "nonce > last_nonce" and both INSERT, producing a duplicate nonce for
    // the same user.
    let locked_row = txn.query_one(Statement::from_sql_and_values(
        DatabaseBackend::MySql,
        "SELECT COALESCE(MAX(nonce), 0) as max_nonce FROM submitter_transactions WHERE from_address = ? FOR UPDATE",
        [user.user_id.to_lowercase().into()],
    )).await.map_err(|e| actix_web::error::ErrorInternalServerError(format!("DB nonce lock failed: {}", e)))?;

    let locked_last_nonce: u64 = locked_row
        .and_then(|row| row.try_get::<Option<u64>>("", "max_nonce").ok())
        .flatten()
        .unwrap_or(0);

    if req.nonce <= locked_last_nonce {
        // Another concurrent request claimed this nonce first.
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Nonce too low — possible replay attack",
            "details": format!("Nonce must be > {}, got {}", locked_last_nonce, req.nonce),
        })));
    }

    // Build calldata for the submitter (ABI-encoded transfer params)
    let calldata_hex = hex::encode(&abi_encoded);
    let token_hex = if token_bytes.is_empty() {
        String::new()
    } else {
        hex::encode(&token_bytes)
    };

    // Insert into submitter_transactions so the background task picks it up
    // BUG-1 fix: Include nonce and from_address for replay protection tracking
    let now = chrono::Utc::now().naive_utc();
    let insert_result = txn.execute(Statement::from_sql_and_values(
        DatabaseBackend::MySql,
        r#"INSERT INTO submitter_transactions (chain_id, from_address, to_address, token_address, amount, calldata, signature, nonce, status, retry_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)"#,
        [
            req.chain_id.into(),
            user.user_id.to_lowercase().into(),
            req.to_address.clone().into(),
            token_hex.into(),
            req.amount.clone().into(),
            calldata_hex.into(),
            req.signature.clone().into(),
            req.nonce.into(),
            now.to_string().into(),
            now.to_string().into(),
        ],
    )).await.map_err(|e| {
        actix_web::error::ErrorInternalServerError(format!("DB insert failed: {}", e))
    })?;

    let payment_id = insert_result.last_insert_id();

    txn.commit().await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("DB transaction commit failed: {}", e)))?;

    tracing::info!(
        "Payment record created: id={}, user={}, chain={}, to={}, amount={}",
        payment_id,
        masked_user,
        req.chain_id,
        common::mask_address(&req.to_address),
        req.amount,
    );

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "pending",
        "paymentId": payment_id,
    })))
}
