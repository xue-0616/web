use actix_web::{web, HttpRequest, HttpResponse};
use sha2::{Sha256, Digest};
use crate::context::PaymentContext;

/// Maximum age for webhook timestamp (300 seconds)
const MAX_WEBHOOK_AGE_SECS: i64 = 300;
/// Redis key prefix for webhook deduplication
const WEBHOOK_DEDUP_PREFIX: &str = "webhook_dedup:onramp:";
/// Dedup TTL in seconds (matches the replay window)
const WEBHOOK_DEDUP_TTL_SECS: u64 = 300;

/// POST /api/v1/ramp/webhook/alchemy-pay/on-ramp
pub async fn handler(
    req: HttpRequest,
    ctx: web::Data<PaymentContext>,
    body: web::Bytes,
) -> HttpResponse {
    // Step 1: Extract X-Timestamp and X-Signature headers
    let timestamp = match req.headers().get("X-Timestamp").and_then(|v| v.to_str().ok()) {
        Some(ts) => ts.to_string(),
        None => {
            tracing::warn!("On-ramp webhook: missing X-Timestamp header");
            return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing X-Timestamp header"}));
        }
    };
    let signature = match req.headers().get("X-Signature").and_then(|v| v.to_str().ok()) {
        Some(sig) => sig.to_string(),
        None => {
            tracing::warn!("On-ramp webhook: missing X-Signature header");
            return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing X-Signature header"}));
        }
    };

    // Step 2: Validate timestamp freshness (prevent replay attacks)
    let ts_val: i64 = match timestamp.parse() {
        Ok(v) => v,
        Err(_) => {
            tracing::warn!("On-ramp webhook: invalid timestamp format");
            return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid timestamp"}));
        }
    };
    let now = chrono::Utc::now().timestamp();
    if (now - ts_val).abs() > MAX_WEBHOOK_AGE_SECS {
        tracing::warn!("On-ramp webhook: timestamp too old (age={}s)", (now - ts_val).abs());
        return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Webhook timestamp expired"}));
    }

    // Step 3: Verify HMAC-SHA256 signature
    // Signing payload = timestamp + raw body
    let secret = &ctx.config.alchemy_pay_secret_key;
    let mut payload = Vec::new();
    payload.extend_from_slice(timestamp.as_bytes());
    payload.extend_from_slice(&body);

    let sig_bytes = match hex::decode(&signature) {
        Ok(b) => b,
        Err(_) => {
            tracing::warn!("On-ramp webhook: invalid signature hex encoding");
            return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid signature encoding"}));
        }
    };

    if !common::crypto::verify_hmac_sha256(secret.as_bytes(), &payload, &sig_bytes) {
        tracing::warn!("On-ramp webhook: HMAC signature verification failed");
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
                    tracing::info!("On-ramp webhook: duplicate detected (hash={}), skipping", &body_hash[..16]);
                    return HttpResponse::Ok().json(serde_json::json!({"status": "ok"}));
                }
            }
            Err(e) => {
                // If Redis is unavailable, log warning but continue processing
                // (better to process a potential duplicate than to drop a valid webhook)
                tracing::warn!("On-ramp webhook: Redis dedup check failed: {}, proceeding anyway", e);
            }
        }
    }

    // Step 5: Parse body and process webhook
    let webhook_body: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("On-ramp webhook: invalid JSON body: {}", e);
            return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid JSON body"}));
        }
    };

    tracing::info!("Processing AlchemyPay on-ramp webhook (signature verified)");

    // Step 6: Extract order identifiers and status from payload
    // AlchemyPay webhook shape (payload): { orderNo, status, cryptoAmount?, ... }
    let order_no = webhook_body.get("orderNo").and_then(|v| v.as_str())
        .or_else(|| webhook_body.get("order_no").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    let new_status = webhook_body.get("status").and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let crypto_amount = webhook_body.get("cryptoAmount").and_then(|v| v.as_str()).map(|s| s.to_string());

    if order_no.is_empty() || new_status.is_empty() {
        tracing::warn!("On-ramp webhook: missing orderNo or status in payload");
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing orderNo or status"}));
    }

    // Step 7: Update alchemy_pay_on_ramp_orders row
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
    let order = match daos::alchemy_pay_on_ramp_orders::Entity::find()
        .filter(daos::alchemy_pay_on_ramp_orders::Column::OrderNo.eq(order_no.clone()))
        .one(ctx.db())
        .await
    {
        Ok(Some(o)) => o,
        Ok(None) => {
            tracing::warn!("On-ramp webhook: no order matching order_no={}", order_no);
            return HttpResponse::Ok().json(serde_json::json!({"status": "ok"}));
        }
        Err(e) => {
            tracing::error!("On-ramp webhook: DB query failed for order_no={}: {}", order_no, e);
            return HttpResponse::InternalServerError().json(serde_json::json!({"error": "DB error"}));
        }
    };

    // Idempotency: if already in the same status, skip
    if order.status == new_status {
        tracing::debug!("On-ramp webhook: order_no={} already in status={}", order_no, new_status);
        return HttpResponse::Ok().json(serde_json::json!({"status": "ok"}));
    }

    let payment_confirmed = matches!(new_status.as_str(),
        "PAY_SUCCESS" | "COMPLETED" | "SUCCESS" | "Confirmed");

    let mut active: daos::alchemy_pay_on_ramp_orders::ActiveModel = order.clone().into();
    active.status = Set(new_status.clone());
    if let Some(amt) = crypto_amount {
        active.crypto_amount = Set(Some(amt));
    }
    active.updated_at = Set(chrono::Utc::now().naive_utc());
    if let Err(e) = active.update(ctx.db()).await {
        tracing::error!("On-ramp webhook: failed to update order_no={}: {}", order_no, e);
        return HttpResponse::InternalServerError().json(serde_json::json!({"error": "DB update failed"}));
    }

    tracing::info!("On-ramp webhook: order_no={} status updated to {}", order_no, new_status);

    // Step 8: If payment confirmed, trigger crypto delivery
    if payment_confirmed {
        tracing::info!(
            "On-ramp webhook: payment confirmed for order_no={} user_id={} — crypto delivery pending",
            order_no, order.user_id
        );
        // NOTE: Actual crypto delivery is handled by the downstream worker that
        // polls for orders in status=PAY_SUCCESS/COMPLETED and builds the
        // on-chain transfer (see payment_manager::delivery_worker).
        // We intentionally do NOT broadcast here — the webhook should be fast
        // and idempotent; delivery has its own retry/confirmation loop.
    }

    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}
