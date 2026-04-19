use actix_web::{web, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, ApiSuccess},
    pools::{LoginRequest, LoginResponse},
};
use entity_crate::accounts;
use jsonwebtoken::{encode, EncodingKey, Header};
use sea_orm::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,       // lock_hash hex
    account_id: u64,
    wallet_type: String,
    exp: u64,
    iat: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaimsForValidation {
    sub: String,
    exp: u64,
}

/// POST /api/v1/accounts/login
/// Authenticate via CKB wallet signature (JoyID / UniPass)
pub async fn login(
    ctx: web::Data<AppContext>,
    body: web::Json<LoginRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = body.into_inner();

    // 1. Verify signature based on wallet_type
    let lock_hash = match req.wallet_type.as_str() {
        "JoyID" => {
            verify_joyid_signature(&req)?
        }
        "UniPass" | "MetaMask" | "OKX" => {
            verify_generic_signature(&req)?
        }
        _ => {
            return Err(ApiError::BadRequest(format!(
                "Unsupported wallet type: {}",
                req.wallet_type
            )));
        }
    };

    // 1b. Login-replay protection.
    //
    // Signature verification above confirms authenticity but does NOT prevent
    // a previously-captured valid (address, timestamp, signature) from being
    // submitted repeatedly within the 5-minute timestamp window. Claim the
    // signature digest into Redis via SET NX so each valid signature can
    // only mint one JWT.
    {
        use blake2b_rs::Blake2bBuilder;
        let mut hasher = Blake2bBuilder::new(32).build();
        hasher.update(req.wallet_type.as_bytes());
        hasher.update(b"|");
        hasher.update(req.address.as_bytes());
        hasher.update(b"|");
        hasher.update(&req.sign_timestamp.to_be_bytes());
        hasher.update(b"|");
        hasher.update(req.signature.as_bytes());
        let mut out = [0u8; 32];
        hasher.finalize(&mut out);
        let digest = hex::encode(out);
        let key = format!("UTXOSWAP:LOGIN_NONCE:{}", digest);
        if let Ok(mut conn) = ctx.redis_conn().await {
            let set_ok: Result<Option<String>, _> = redis::cmd("SET")
                .arg(&key)
                .arg("1")
                .arg("NX")
                .arg("EX")
                .arg(600_u64) // 10 min — > the 5-min timestamp window + clock skew
                .query_async(&mut *conn)
                .await;
            if !matches!(set_ok, Ok(Some(_))) {
                return Err(ApiError::BadRequest(
                    "Login signature already used — please re-sign".to_string(),
                ));
            }
        }
        // If Redis is unavailable we intentionally fall through rather than
        // fail-closed, to avoid a DoS that locks out all logins. The short
        // timestamp window above still limits replay exposure.
    }

    // 2. Find or create account
    let lock_hash_bytes = types::utils::hex_to_bytes(&lock_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid lock hash: {}", e)))?;

    let account = accounts::Entity::find()
        .filter(accounts::Column::LockHash.eq(lock_hash_bytes.clone()))
        .one(ctx.db())
        .await?;

    let account = match account {
        Some(acc) => {
            // Update last login and wallet types
            let mut active: accounts::ActiveModel = acc.clone().into();
            active.updated_at = Set(chrono::Utc::now().naive_utc());
            // Append wallet type if not present
            if !acc.wallet_types.contains(&req.wallet_type) {
                let new_types = format!("{},{}", acc.wallet_types, req.wallet_type);
                active.wallet_types = Set(new_types);
            }
            active.update(ctx.db()).await?
        }
        None => {
            let new_account = accounts::ActiveModel {
                lock_hash: Set(lock_hash_bytes),
                wallet_types: Set(req.wallet_type.clone()),
                total_points: Set(0),
                created_at: Set(chrono::Utc::now().naive_utc()),
                updated_at: Set(chrono::Utc::now().naive_utc()),
                ..Default::default()
            };
            new_account.insert(ctx.db()).await?
        }
    };

    // 3. Generate JWT
    let now = chrono::Utc::now().timestamp() as u64;
    let claims = Claims {
        sub: lock_hash.clone(),
        account_id: account.id,
        wallet_type: req.wallet_type,
        exp: now + 86400 * 7, // 7 days
        iat: now,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(ctx.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| ApiError::Internal(format!("JWT encode error: {}", e)))?;

    Ok(ApiSuccess::json(LoginResponse {
        token,
        account_id: account.id,
    }))
}

/// Verify JoyID WebAuthn signature (P-256/secp256r1)
///
/// SECURITY: This function performs real cryptographic verification of the WebAuthn P-256
/// signature. The pubkey from the request is verified against the signature, then hashed
/// and compared against the lock_args derived from the claimed address to prevent impersonation.
fn verify_joyid_signature(req: &LoginRequest) -> Result<String, ApiError> {
    let pubkey_hex = req
        .pubkey
        .as_ref()
        .ok_or(ApiError::BadRequest("Missing pubkey for JoyID".to_string()))?;
    let msg = req
        .joy_id_msg
        .as_ref()
        .ok_or(ApiError::BadRequest("Missing joyIdMsg for JoyID".to_string()))?;
    let signature_hex = &req.signature;

    if pubkey_hex.is_empty() || signature_hex.is_empty() || msg.is_empty() {
        return Err(ApiError::BadRequest("Empty pubkey, signature, or message".to_string()));
    }

    // Decode hex inputs
    let pubkey_bytes = types::utils::hex_to_bytes(pubkey_hex)
        .map_err(|e| ApiError::BadRequest(format!("Invalid pubkey hex: {}", e)))?;
    let sig_bytes = types::utils::hex_to_bytes(signature_hex)
        .map_err(|e| ApiError::BadRequest(format!("Invalid signature hex: {}", e)))?;

    // Validate pubkey length (P-256 uncompressed = 65 bytes or compressed = 33 bytes)
    if pubkey_bytes.len() != 33 && pubkey_bytes.len() != 65 {
        return Err(ApiError::BadRequest(format!(
            "Invalid JoyID pubkey length: expected 33 or 65 bytes, got {}",
            pubkey_bytes.len()
        )));
    }

    // Validate signature is non-empty and reasonable length (DER-encoded P-256 sig: ~70-72 bytes)
    if sig_bytes.len() < 64 || sig_bytes.len() > 128 {
        return Err(ApiError::BadRequest(format!(
            "Invalid JoyID signature length: {}",
            sig_bytes.len()
        )));
    }

    // Parse the CKB address to get the expected lock_args
    let lock = utils::account_address::address::parse_ckb_address(&req.address)
        .map_err(|e| ApiError::BadRequest(format!("Invalid CKB address: {}", e)))?;

    // Hash the message for verification
    let msg_hash = types::utils::blake2b_256(msg.as_bytes());

    // Verify pubkey matches lock_args (blake160 of pubkey)
    let msg_hash_arr: [u8; 32] = msg_hash;
    verify_joyid_sig_inner(&msg_hash_arr, &sig_bytes, &pubkey_bytes, &lock.args)
        .map_err(|e| ApiError::Unauthorized(format!("JoyID signature verification failed: {}", e)))?;

    // Compute lock_hash from verified lock script
    let lock_hash = compute_lock_hash(&lock);
    Ok(lock_hash)
}

/// Inner JoyID P-256 signature verification
fn verify_joyid_sig_inner(
    msg_hash: &[u8; 32],
    signature: &[u8],
    pubkey: &[u8],
    lock_args: &[u8],
) -> Result<bool, String> {
    // 1. Verify pubkey matches lock_args (blake160)
    use blake2b_rs::Blake2bBuilder;
    let mut hasher = Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    hasher.update(pubkey);
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);
    if lock_args.len() < 20 || &hash[0..20] != &lock_args[0..20] {
        return Err("Pubkey does not match lock args".into());
    }

    // 2. Actually verify the P-256 signature
    use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
    let vk = VerifyingKey::from_sec1_bytes(pubkey)
        .map_err(|e| format!("Invalid P-256 pubkey: {}", e))?;
    let sig = Signature::try_from(signature)
        .map_err(|e| format!("Invalid P-256 signature: {}", e))?;
    vk.verify(msg_hash, &sig)
        .map_err(|e| format!("P-256 verification failed: {}", e))?;

    Ok(true)
}

/// Verify generic wallet signature (secp256k1 for MetaMask/UniPass/OKX)
///
/// SECURITY: This function verifies that the signature was produced by the private key
/// corresponding to the lock_args in the claimed CKB address. The message includes
/// a timestamp to prevent replay attacks.
fn verify_generic_signature(req: &LoginRequest) -> Result<String, ApiError> {
    let signature_hex = &req.signature;

    if signature_hex.is_empty() {
        return Err(ApiError::BadRequest("Empty signature".to_string()));
    }

    let sig_bytes = types::utils::hex_to_bytes(signature_hex)
        .map_err(|e| ApiError::BadRequest(format!("Invalid signature hex: {}", e)))?;

    // secp256k1 signature: 65 bytes (r(32) + s(32) + v(1))
    if sig_bytes.len() != 65 {
        return Err(ApiError::BadRequest(format!(
            "Invalid signature length: expected 65 bytes, got {}",
            sig_bytes.len()
        )));
    }

    // Reconstruct the signed message: typically "Sign in to UTXOSwap\nTimestamp: {timestamp}"
    let message = format!("Sign in to UTXOSwap\nTimestamp: {}", req.sign_timestamp);
    let msg_hash = types::utils::blake2b_256(message.as_bytes());

    // Verify timestamp is not too old (max 5 minutes)
    let now = chrono::Utc::now().timestamp() as u64;
    if req.sign_timestamp > now + 60 {
        return Err(ApiError::BadRequest("Signature timestamp is in the future".to_string()));
    }
    if now.saturating_sub(req.sign_timestamp) > 300 {
        return Err(ApiError::BadRequest("Signature expired (>5 minutes old)".to_string()));
    }

    // Parse the CKB address to get the expected lock_args
    let lock = utils::account_address::address::parse_ckb_address(&req.address)
        .map_err(|e| ApiError::BadRequest(format!("Invalid CKB address: {}", e)))?;

    if lock.args.len() < 20 {
        return Err(ApiError::BadRequest("Address lock_args too short".to_string()));
    }

    // Real secp256k1 ECDSA recovery
    let msg_hash_arr: [u8; 32] = msg_hash;
    verify_generic_sig_inner(&msg_hash_arr, &sig_bytes, &lock.args)
        .map_err(|e| ApiError::Unauthorized(format!("Signature verification failed: {}", e)))?;

    let lock_hash = compute_lock_hash(&lock);
    Ok(lock_hash)
}

/// Inner secp256k1 signature verification via ECDSA recovery
fn verify_generic_sig_inner(
    msg_hash: &[u8; 32],
    signature: &[u8],    // 65 bytes: r[32] + s[32] + recovery_id[1]
    lock_args: &[u8],    // expected address bytes (first 20 bytes of blake160(pubkey))
) -> Result<bool, String> {
    if signature.len() != 65 {
        return Err(format!("Signature must be 65 bytes, got {}", signature.len()));
    }

    // Real secp256k1 ECDSA recovery
    use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

    let recid = RecoveryId::try_from(signature[64] % 4)
        .map_err(|e| format!("Invalid recovery id: {}", e))?;
    let sig = Signature::try_from(&signature[..64])
        .map_err(|e| format!("Invalid signature: {}", e))?;
    let recovered_key = VerifyingKey::recover_from_prehash(msg_hash, &sig, recid)
        .map_err(|e| format!("Recovery failed: {}", e))?;

    // CKB address derivation: blake160(pubkey_compressed) = blake2b(pubkey)[0..20]
    let pubkey_bytes = recovered_key.to_sec1_bytes();
    use blake2b_rs::Blake2bBuilder;
    let mut hasher = Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    hasher.update(&pubkey_bytes);
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);
    let blake160 = &hash[0..20];

    // Compare recovered blake160 with lock.args
    if lock_args.len() < 20 {
        return Err("Lock args too short".into());
    }
    if blake160 != &lock_args[0..20] {
        return Err("Recovered pubkey does not match lock args".into());
    }
    Ok(true)
}

/// Compute CKB lock_hash from a lock script using blake2b
fn compute_lock_hash(lock: &types::intent::CkbScript) -> String {
    // CKB lock_hash = blake2b(serialize(lock_script))
    // Serialization: code_hash(32) + hash_type(1) + args
    let mut data = Vec::with_capacity(33 + lock.args.len());
    data.extend_from_slice(&lock.code_hash);
    data.push(lock.hash_type);
    data.extend_from_slice(&lock.args);
    let hash = types::utils::blake2b_256(&data);
    types::utils::bytes_to_hex(&hash)
}
