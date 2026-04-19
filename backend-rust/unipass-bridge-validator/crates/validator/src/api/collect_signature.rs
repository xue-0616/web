use actix_web::{web, HttpResponse};
use serde::Deserialize;

/// Request to submit a validator signature for multisig collection.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectSignatureRequest {
    /// EIP-712 message hash (0x-prefixed, 32-byte hex).
    pub msg_hash: String,
    /// Validator's signature over the message hash (0x-prefixed, 65-byte hex).
    pub signature: String,
}

/// POST /api/v1/collect-signature — receive a validator signature for multisig threshold.
///
/// Flow:
/// 1. Validate input format
/// 2. Recover signer address via ecrecover
/// 3. Verify signer is in the authorized validator set
/// 4. Store signature in Redis (same key as handler uses)
/// 5. Return current count vs threshold
pub async fn handler(
    ctx: web::Data<api::ValidatorContext>,
    body: web::Json<CollectSignatureRequest>,
) -> HttpResponse {
    let req = body.into_inner();

    // --- Input validation ---
    let msg_hash_clean = req.msg_hash.trim_start_matches("0x");
    if msg_hash_clean.len() != 64 || !msg_hash_clean.chars().all(|c| c.is_ascii_hexdigit()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "status": "rejected",
            "reason": "msg_hash must be 0x-prefixed 32-byte hex (64 hex chars)"
        }));
    }
    let msg_hash_bytes: [u8; 32] = match hex::decode(msg_hash_clean) {
        Ok(b) if b.len() == 32 => {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&b);
            arr
        }
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "status": "rejected",
                "reason": "Invalid msg_hash hex"
            }));
        }
    };

    let sig_clean = req.signature.trim_start_matches("0x");
    if sig_clean.len() != 130 || !sig_clean.chars().all(|c| c.is_ascii_hexdigit()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "status": "rejected",
            "reason": "signature must be 0x-prefixed 65-byte hex (130 hex chars)"
        }));
    }
    let sig_bytes = match hex::decode(sig_clean) {
        Ok(b) if b.len() == 65 => b,
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "status": "rejected",
                "reason": "Invalid signature hex"
            }));
        }
    };

    // --- Recover signer address via ecrecover ---
    let recovered_address = match validator_signer::recover_signer(&sig_bytes, &msg_hash_bytes) {
        Ok(addr) => addr,
        Err(e) => {
            tracing::warn!("Failed to recover signer from signature: {}", e);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "status": "rejected",
                "reason": "Cannot recover signer from signature"
            }));
        }
    };

    let recovered_addr_hex = format!("{:?}", recovered_address).to_lowercase();

    // --- Verify signer is in authorized validator set ---
    let validator_set = ctx.config.validator_set_addresses();
    if !validator_set.contains(&recovered_addr_hex) {
        tracing::warn!(
            "Signature from unauthorized validator: {} (not in validator set)",
            recovered_addr_hex
        );
        return HttpResponse::Forbidden().json(serde_json::json!({
            "status": "rejected",
            "reason": "Signer address is not in the authorized validator set"
        }));
    }

    // --- Also verify using verify_validator_signature for defense-in-depth ---
    let expected_bytes = recovered_address.as_bytes();
    let mut expected_arr = [0u8; 20];
    expected_arr.copy_from_slice(expected_bytes);
    if !validator_signer::verify_validator_signature(&msg_hash_bytes, &sig_bytes, &expected_arr) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "status": "rejected",
            "reason": "Signature verification failed"
        }));
    }

    // --- Store in Redis and check threshold ---
    let msg_hash_hex = format!("0x{}", msg_hash_clean.to_lowercase());
    let sig_hex = format!("0x{}", sig_clean.to_lowercase());
    let threshold = ctx.config.threshold;

    match validator_handler::collect_multisig_signature(
        &ctx,
        &msg_hash_hex,
        &recovered_addr_hex,
        &sig_hex,
        threshold,
    )
    .await
    {
        Ok(result) => {
            if result.threshold_met {
                tracing::info!(
                    "Multisig threshold met via collect-signature: msg_hash={}, count={}",
                    msg_hash_hex,
                    result.count
                );
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "threshold_met",
                    "msg_hash": msg_hash_hex,
                    "signer": recovered_addr_hex,
                    "signatures_collected": result.count,
                    "threshold_required": threshold,
                    "all_signatures": result.all_signatures,
                }))
            } else {
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "pending",
                    "msg_hash": msg_hash_hex,
                    "signer": recovered_addr_hex,
                    "signatures_collected": result.count,
                    "threshold_required": threshold,
                }))
            }
        }
        Err(e) => {
            tracing::error!("Multisig collection error: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "status": "error",
                "reason": "Internal error during signature collection"
            }))
        }
    }
}
