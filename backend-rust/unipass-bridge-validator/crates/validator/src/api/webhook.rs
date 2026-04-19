use actix_web::{web, HttpRequest, HttpResponse};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

/// Maximum age of webhook timestamp before rejection (seconds).
const MAX_WEBHOOK_TIMESTAMP_AGE_SECS: u64 = 300;

/// POST /api/v1/webhook — receive bridge events from external services.
/// Requires HMAC signature verification in X-Signature header.
/// Also verifies X-Timestamp freshness to prevent replay attacks (MEDIUM-17).
pub async fn handler(
    ctx: web::Data<api::ValidatorContext>,
    req: HttpRequest,
    body: web::Bytes,
) -> HttpResponse {
    // Verify HMAC signature
    let webhook_secret = &ctx.config.webhook_secret;
    if webhook_secret.is_empty() {
        tracing::error!("Webhook secret not configured — rejecting webhook");
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Webhook not configured"
        }));
    }

    let signature_header = req
        .headers()
        .get("X-Signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if signature_header.is_empty() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Missing X-Signature header"
        }));
    }

    // --- MEDIUM-17: Verify X-Timestamp freshness ---
    let timestamp_header = req
        .headers()
        .get("X-Timestamp")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if timestamp_header.is_empty() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Missing X-Timestamp header"
        }));
    }

    let timestamp_secs: u64 = match timestamp_header.parse() {
        Ok(ts) => ts,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid X-Timestamp format (must be Unix epoch seconds)"
            }));
        }
    };

    // Check timestamp freshness — reject if older than 300 seconds
    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let age = if now_secs >= timestamp_secs {
        now_secs - timestamp_secs
    } else {
        // Timestamp is in the future — also suspicious
        timestamp_secs - now_secs
    };

    if age > MAX_WEBHOOK_TIMESTAMP_AGE_SECS {
        tracing::warn!(
            "Webhook timestamp too old/future: age={}s (max={}s)",
            age,
            MAX_WEBHOOK_TIMESTAMP_AGE_SECS
        );
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Webhook timestamp expired (>300s)"
        }));
    }

    // Compute expected HMAC over timestamp + body (MEDIUM-17)
    let mut mac = match HmacSha256::new_from_slice(webhook_secret.as_bytes()) {
        Ok(m) => m,
        Err(_) => {
            tracing::error!("Invalid webhook secret key");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal error"
            }));
        }
    };
    // HMAC covers timestamp + "." separator + body to bind signature to timestamp
    // The dot separator prevents canonicalization attacks where attacker could
    // shift bytes between timestamp and body to produce the same HMAC
    mac.update(timestamp_header.as_bytes());
    mac.update(b".");  // separator prevents canonicalization attacks
    mac.update(&body);
    let expected = hex::encode(mac.finalize().into_bytes());

    // Constant-time comparison to prevent timing attacks
    let sig_clean = signature_header.trim_start_matches("sha256=");
    if expected.as_bytes().ct_eq(sig_clean.as_bytes()).into() {
        tracing::info!("Webhook received with valid signature, payload_size={}", body.len());

        // Parse and process the webhook payload
        let payload: serde_json::Value = match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(e) => {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": format!("Invalid JSON: {}", e)
                }));
            }
        };

        let event_type = payload.get("type").and_then(|v| v.as_str()).unwrap_or("unknown");
        tracing::info!("Webhook event type: {}", event_type);

        // If the webhook contains bridge event data, run full validation pipeline — FAIL CLOSED
        if event_type == "bridge_event" || event_type == "deposit" {
            let source_chain_id = payload.get("sourceChainId").and_then(|v| v.as_u64());
            let dest_chain_id = payload.get("destChainId").and_then(|v| v.as_u64());
            let tx_hash = payload.get("txHash").and_then(|v| v.as_str());
            let log_index = payload.get("logIndex").and_then(|v| v.as_u64()).map(|v| v as u32);
            let amount = payload.get("amount").and_then(|v| v.as_str());
            let token_address = payload.get("tokenAddress").and_then(|v| v.as_str());
            let sender = payload.get("sender").and_then(|v| v.as_str());
            let recipient = payload.get("recipient").and_then(|v| v.as_str());

            // All fields must be present for bridge event validation
            match (source_chain_id, dest_chain_id, tx_hash, amount, token_address, sender, recipient) {
                (Some(sc), Some(dc), Some(th), Some(amt), Some(ta), Some(s), Some(r)) => {
                    let validation_req = validator_handler::ValidationRequest {
                        source_chain_id: sc,
                        dest_chain_id: dc,
                        tx_hash: th.to_string(),
                        log_index,
                        amount: amt.to_string(),
                        token_address: ta.to_string(),
                        sender: s.to_string(),
                        recipient: r.to_string(),
                    };

                    match validator_handler::validate_payment(&ctx, &validation_req).await {
                        Ok(result) => {
                            if result.valid {
                                tracing::info!(
                                    "Webhook bridge event validated: tx={}",
                                    th
                                );
                                return HttpResponse::Ok().json(serde_json::json!({
                                    "status": "validated",
                                    "signature": result.signature,
                                    "msg_hash": result.msg_hash,
                                    "signatures_collected": result.signatures_collected,
                                    "threshold_required": result.threshold_required,
                                }));
                            } else {
                                tracing::warn!(
                                    "Webhook bridge event rejected: tx={}, reason={:?}",
                                    th, result.rejection_reason
                                );
                                return HttpResponse::Ok().json(serde_json::json!({
                                    "status": "rejected",
                                    "reason": result.rejection_reason,
                                }));
                            }
                        }
                        Err(e) => {
                            tracing::error!("Webhook validation error for tx={}: {}", th, e);
                            return HttpResponse::UnprocessableEntity().json(serde_json::json!({
                                "status": "rejected",
                                "reason": format!("Validation failed: {}", e),
                            }));
                        }
                    }
                }
                _ => {
                    tracing::warn!("Webhook bridge event missing required fields — rejecting");
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "status": "rejected",
                        "reason": "Bridge event webhook missing required fields (sourceChainId, destChainId, txHash, amount, tokenAddress, sender, recipient)"
                    }));
                }
            }
        }

        // Non-bridge webhook events — acknowledge receipt
        HttpResponse::Ok().json(serde_json::json!({"status": "received"}))
    } else {
        tracing::warn!("Webhook signature mismatch — rejecting");
        HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid signature"
        }))
    }
}
