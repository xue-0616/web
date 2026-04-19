use actix_web::{web, HttpResponse};
use crate::context::PaymentContext;
use serde::Deserialize;
use daos;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub keyset_hash: String,
    pub signature: String,
    pub message: String,
}

/// Verify EIP-191 personal_sign signature and recover signer address.
/// Returns the recovered address as lowercase hex (0x-prefixed).
fn verify_eip191_signature(message: &str, signature_hex: &str) -> Result<String, String> {
    // 1. Decode signature (65 bytes: r[32] + s[32] + v[1])
    let sig_bytes = hex::decode(signature_hex.trim_start_matches("0x"))
        .map_err(|e| format!("Invalid signature hex: {}", e))?;
    if sig_bytes.len() != 65 {
        return Err(format!("Signature must be 65 bytes, got {}", sig_bytes.len()));
    }

    // 2. EIP-191 message hash: keccak256("\x19Ethereum Signed Message:\n" + len + message)
    use sha3::{Keccak256, Digest};
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut hasher = Keccak256::new();
    hasher.update(prefix.as_bytes());
    hasher.update(message.as_bytes());
    let msg_hash = hasher.finalize();

    // 3. Recover signer via secp256k1
    let recovery_id = match sig_bytes[64] {
        v @ 0..=1 => v,
        v @ 27..=28 => v - 27,
        v => return Err(format!("Invalid recovery id: {}", v)),
    };

    use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
    let recid = RecoveryId::try_from(recovery_id)
        .map_err(|e| format!("Invalid recovery id: {}", e))?;
    let signature = Signature::try_from(&sig_bytes[..64])
        .map_err(|e| format!("Invalid signature: {}", e))?;
    let recovered_key = VerifyingKey::recover_from_prehash(&msg_hash, &signature, recid)
        .map_err(|e| format!("Recovery failed: {}", e))?;

    // 4. Derive Ethereum address: keccak256(pubkey_uncompressed[1..65])[12..32]
    let pubkey_bytes = recovered_key.to_encoded_point(false);
    let mut addr_hasher = Keccak256::new();
    addr_hasher.update(&pubkey_bytes.as_bytes()[1..]); // skip 0x04 prefix
    let addr_hash = addr_hasher.finalize();
    let address = format!("0x{}", hex::encode(&addr_hash[12..32]));

    Ok(address)
}

/// Parse and validate the login message timestamp.
/// Expected message format: "Login to PaymentServer at <unix_timestamp>"
fn validate_message_timestamp(message: &str, max_age_secs: i64) -> Result<(), String> {
    // Extract timestamp from message
    let timestamp_str = message
        .rsplit("at ")
        .next()
        .ok_or("Message must contain 'at <timestamp>'")?
        .trim();

    let msg_timestamp: i64 = timestamp_str
        .parse()
        .map_err(|_| "Invalid timestamp in message")?;

    let now = chrono::Utc::now().timestamp();
    let age = (now - msg_timestamp).abs();

    if age > max_age_secs {
        return Err(format!(
            "Message timestamp too old or in future: age={}s, max={}s",
            age, max_age_secs
        ));
    }

    Ok(())
}

/// POST /api/v1/account/login
pub async fn handler(ctx: web::Data<PaymentContext>, body: web::Json<LoginRequest>) -> actix_web::Result<HttpResponse> {
    let masked_hash = common::mask_address(&body.keyset_hash);

    // Step 1: Validate keyset_hash format (64-char hex)
    let clean_hash = body.keyset_hash.strip_prefix("0x").unwrap_or(&body.keyset_hash);
    if clean_hash.len() != 64 || hex::decode(clean_hash).is_err() {
        tracing::warn!("Login failed: invalid keyset_hash format for {}", masked_hash);
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid keyset_hash format"
        })));
    }

    // Step 2: Verify message timestamp (replay protection — 300s window)
    if let Err(e) = validate_message_timestamp(&body.message, 300) {
        tracing::warn!("Login failed: timestamp validation error for {}: {}", masked_hash, e);
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Message timestamp validation failed",
            "details": e
        })));
    }

    // Step 3: Verify EIP-191 signature and recover signer address
    let recovered = match verify_eip191_signature(&body.message, &body.signature) {
        Ok(addr) => addr,
        Err(e) => {
            tracing::warn!("Login failed: signature verification error for {}: {}", masked_hash, e);
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Signature verification failed",
                "details": e
            })));
        }
    };

    // Step 3b: Verify the recovered address matches the user's registered address (by keyset_hash)
    // Look up registered address from DB using keyset_hash
    let db = ctx.db();
    let registered = daos::accounts::find_by_keyset_hash(db, &body.keyset_hash).await;
    match registered {
        Ok(Some(account)) => {
            if account.address.to_lowercase() != recovered.to_lowercase() {
                tracing::warn!(
                    "Login failed: recovered address {} does not match registered address for {}",
                    common::mask_address(&recovered),
                    masked_hash
                );
                return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                    "error": "Signature does not match registered address"
                })));
            }
        }
        Ok(None) => {
            tracing::warn!("Login failed: no account found for keyset_hash {}", masked_hash);
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Account not found"
            })));
        }
        Err(e) => {
            tracing::error!("Login failed: DB error looking up keyset_hash {}: {}", masked_hash, e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Step 4: Issue JWT with the user's ETH address as subject.
    //
    // The auth middleware exposes `claims.sub` as `AuthenticatedUser.user_id`,
    // and downstream handlers (e.g. `payment::send`) compare `user_id`
    // against the ECDSA-recovered signer address. Using `keyset_hash` as
    // subject would always fail that comparison (a 64-char hash vs. a
    // 40-char 0x-prefixed address), effectively breaking every authenticated
    // request. Use the recovered address, which we have already verified
    // matches the registered account.
    let subject = recovered.to_lowercase();
    let token = common::auth::create_token(&ctx.config.jwt_secret, &subject, 86400)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    tracing::info!(
        "User logged in: keyset_hash={}, address={}",
        masked_hash,
        common::mask_address(&subject),
    );
    Ok(HttpResponse::Ok().json(serde_json::json!({"token": token})))
}
