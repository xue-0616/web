use actix_web::{web, HttpRequest, HttpResponse};
use sha2::{Sha256, Digest};
use crate::context::PaymentContext;

/// Maximum age for webhook timestamp (300 seconds)
const MAX_WEBHOOK_AGE_SECS: i64 = 300;
/// Redis key prefix for webhook deduplication
const WEBHOOK_DEDUP_PREFIX: &str = "webhook_dedup:offramp:";
/// Dedup TTL in seconds (matches the replay window)
const WEBHOOK_DEDUP_TTL_SECS: u64 = 300;

/// POST /api/v1/ramp/webhook/alchemy-pay/off-ramp
pub async fn handler(
    req: HttpRequest,
    ctx: web::Data<PaymentContext>,
    body: web::Bytes,
) -> HttpResponse {
    // Step 1: Extract X-Timestamp and X-Signature headers
    let timestamp = match req.headers().get("X-Timestamp").and_then(|v| v.to_str().ok()) {
        Some(ts) => ts.to_string(),
        None => {
            tracing::warn!("Off-ramp webhook: missing X-Timestamp header");
            return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing X-Timestamp header"}));
        }
    };
    let signature = match req.headers().get("X-Signature").and_then(|v| v.to_str().ok()) {
        Some(sig) => sig.to_string(),
        None => {
            tracing::warn!("Off-ramp webhook: missing X-Signature header");
            return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing X-Signature header"}));
        }
    };

    // Step 2: Validate timestamp freshness (prevent replay attacks)
    let ts_val: i64 = match timestamp.parse() {
        Ok(v) => v,
        Err(_) => {
            tracing::warn!("Off-ramp webhook: invalid timestamp format");
            return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid timestamp"}));
        }
    };
    let now = chrono::Utc::now().timestamp();
    if (now - ts_val).abs() > MAX_WEBHOOK_AGE_SECS {
        tracing::warn!("Off-ramp webhook: timestamp too old (age={}s)", (now - ts_val).abs());
        return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Webhook timestamp expired"}));
    }

    // Step 3: Verify HMAC-SHA256 signature
    let secret = &ctx.config.alchemy_pay_secret_key;
    let mut payload = Vec::new();
    payload.extend_from_slice(timestamp.as_bytes());
    payload.extend_from_slice(&body);

    let sig_bytes = match hex::decode(&signature) {
        Ok(b) => b,
        Err(_) => {
            tracing::warn!("Off-ramp webhook: invalid signature hex encoding");
            return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid signature encoding"}));
        }
    };

    if !common::crypto::verify_hmac_sha256(secret.as_bytes(), &payload, &sig_bytes) {
        tracing::warn!("Off-ramp webhook: HMAC signature verification failed");
        return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid webhook signature"}));
    }

    // Step 4 (BUG-13 fix): Deduplicate webhook using SHA-256 hash of body + Redis SET NX
    {
        let body_hash = hex::encode(Sha256::digest(&body));
        let dedup_key = format!("{}{}", WEBHOOK_DEDUP_PREFIX, body_hash);
        match ctx.redis_conn().await {
            Ok(mut redis) => {
                let result: Option<String> = redis::cmd("SET")
                    .arg(&dedup_key)
                    .arg("1")
                    .arg("NX")
                    .arg("EX")
                    .arg(WEBHOOK_DEDUP_TTL_SECS)
                    .query_async(&mut redis)
                    .await
                    .unwrap_or(None);
                if result.is_none() {
                    tracing::info!("Off-ramp webhook: duplicate detected (hash={}), skipping", &body_hash[..16]);
                    return HttpResponse::Ok().json(serde_json::json!({"status": "ok"}));
                }
            }
            Err(e) => {
                // If Redis is unavailable, log warning but continue processing
                tracing::warn!("Off-ramp webhook: Redis dedup check failed: {}, proceeding anyway", e);
            }
        }
    }

    // Step 5: Parse body and process webhook
    let _webhook_body: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("Off-ramp webhook: invalid JSON body: {}", e);
            return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid JSON body"}));
        }
    };

    tracing::info!("Processing AlchemyPay off-ramp webhook (signature verified)");
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}
