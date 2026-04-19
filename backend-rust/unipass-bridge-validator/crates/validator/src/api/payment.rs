use actix_web::{web, HttpRequest, HttpResponse};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// Per-IP rate limiter for validation endpoints (MEDIUM-13).
/// Stricter than the global rate limiter: 10 requests/minute per IP.
static VALIDATION_RATE_LIMITER: std::sync::LazyLock<Mutex<HashMap<String, (Instant, u32)>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

/// Maximum number of tracked IPs to prevent memory exhaustion.
const MAX_TRACKED_IPS: usize = 100_000;
/// Maximum validation requests per minute per IP.
const VALIDATION_RATE_LIMIT: u32 = 10;
/// Rate limit window in seconds.
const RATE_LIMIT_WINDOW_SECS: u64 = 60;

/// Check if a given IP is rate-limited for validation endpoints.
/// Returns true if the request should be rejected.
fn check_validation_rate_limit(ip: &str) -> bool {
    let mut map = match VALIDATION_RATE_LIMITER.lock() {
        Ok(m) => m,
        Err(_) => return false, // If lock is poisoned, fail open for availability
    };

    let now = Instant::now();

    // Periodic cleanup: remove expired entries if map is getting large
    if map.len() > MAX_TRACKED_IPS / 2 {
        map.retain(|_, (timestamp, _)| now.duration_since(*timestamp).as_secs() < RATE_LIMIT_WINDOW_SECS);
    }

    // Reject new IPs if at capacity (prevent memory exhaustion)
    if map.len() >= MAX_TRACKED_IPS && !map.contains_key(ip) {
        tracing::warn!("Rate limiter at capacity ({}), rejecting new IP", MAX_TRACKED_IPS);
        return true;
    }

    let entry = map.entry(ip.to_string()).or_insert((now, 0));

    // Reset counter if window has expired
    if now.duration_since(entry.0).as_secs() >= RATE_LIMIT_WINDOW_SECS {
        *entry = (now, 1);
        return false;
    }

    entry.1 += 1;
    entry.1 > VALIDATION_RATE_LIMIT
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidatePaymentRequest {
    pub source_chain_id: u64,
    pub dest_chain_id: u64,
    pub tx_hash: String,
    pub log_index: Option<u32>,
    pub amount: String,
    pub token_address: String,
    pub sender: String,
    pub recipient: String,
}

/// POST /api/v1/payment — validate a cross-chain bridge payment.
///
/// Full validation pipeline:
/// 1. Rate limit check (10 req/min per IP for validation endpoints)
/// 2. Input validation (format, whitelist, limits)
/// 3. Replay check
/// 4. On-chain transaction receipt verification
/// 5. Block confirmation check
/// 6. Log data verification (parameters match claimed values)
/// 7. EIP-712 signing
/// 8. Record as processed
///
/// Returns signature on success, detailed rejection reason on failure.
pub async fn handler(
    ctx: web::Data<api::ValidatorContext>,
    http_req: HttpRequest,
    body: web::Json<ValidatePaymentRequest>,
) -> HttpResponse {
    // --- MEDIUM-13: Per-IP rate limiting for validation endpoints ---
    // Use peer_addr() only (not X-Forwarded-For) to prevent spoofing
    let client_ip = http_req
        .peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    if check_validation_rate_limit(&client_ip) {
        tracing::warn!("Validation rate limit exceeded for IP: {}", client_ip);
        return HttpResponse::TooManyRequests().json(serde_json::json!({
            "status": "rejected",
            "reason": "Rate limit exceeded for validation endpoints (10 requests/minute)"
        }));
    }

    let req = body.into_inner();
    tracing::info!(
        "Validate bridge payment: {}→{}, tx={}",
        req.source_chain_id,
        req.dest_chain_id,
        req.tx_hash
    );

    // Build validation request
    let validation_req = validator_handler::ValidationRequest {
        source_chain_id: req.source_chain_id,
        dest_chain_id: req.dest_chain_id,
        tx_hash: req.tx_hash.clone(),
        log_index: req.log_index,
        amount: req.amount.clone(),
        token_address: req.token_address.clone(),
        sender: req.sender.clone(),
        recipient: req.recipient.clone(),
    };

    // Run full validation pipeline — FAIL CLOSED
    match validator_handler::validate_payment(&ctx, &validation_req).await {
        Ok(result) => {
            match result.status.as_str() {
                "approved" => {
                    tracing::info!("Payment validated (threshold met): tx={}", req.tx_hash);
                    HttpResponse::Ok().json(serde_json::json!({
                        "status": "approved",
                        "signature": result.signature,
                        "all_signatures": result.all_signatures,
                        "msg_hash": result.msg_hash,
                        "signatures_collected": result.signatures_collected,
                        "threshold_required": result.threshold_required,
                        "tx_hash": req.tx_hash,
                    }))
                }
                "pending_multisig" => {
                    tracing::info!(
                        "Payment signed, pending multisig: tx={}, {}/{} signatures",
                        req.tx_hash,
                        result.signatures_collected,
                        result.threshold_required
                    );
                    HttpResponse::Ok().json(serde_json::json!({
                        "status": "pending",
                        "signature": result.signature,
                        "msg_hash": result.msg_hash,
                        "signatures_collected": result.signatures_collected,
                        "threshold_required": result.threshold_required,
                        "tx_hash": req.tx_hash,
                    }))
                }
                "rejected" => {
                    tracing::warn!(
                        "Payment rejected: tx={}, reason={:?}",
                        req.tx_hash,
                        result.rejection_reason
                    );
                    HttpResponse::Ok().json(serde_json::json!({
                        "status": "rejected",
                        "reason": result.rejection_reason,
                    }))
                }
                _ => {
                    // Unknown status — fail closed
                    tracing::error!("Unknown validation status '{}' for tx={}", result.status, req.tx_hash);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "status": "rejected",
                        "reason": "Internal validation error",
                    }))
                }
            }
        }
        Err(e) => {
            // Fail closed: return specific error but do NOT approve
            tracing::error!("Validation error for tx={}: {}", req.tx_hash, e);
            let (status_code, reason) = match &e {
                validator_handler::ValidationError::InvalidInput(_) => {
                    (actix_web::http::StatusCode::BAD_REQUEST, e.to_string())
                }
                validator_handler::ValidationError::UnsupportedChain(_) => {
                    (actix_web::http::StatusCode::BAD_REQUEST, e.to_string())
                }
                validator_handler::ValidationError::UnwhitelistedToken(_) => {
                    (actix_web::http::StatusCode::BAD_REQUEST, e.to_string())
                }
                validator_handler::ValidationError::ReplayDetected => {
                    (actix_web::http::StatusCode::CONFLICT, e.to_string())
                }
                validator_handler::ValidationError::TxNotConfirmed => {
                    (actix_web::http::StatusCode::UNPROCESSABLE_ENTITY, e.to_string())
                }
                validator_handler::ValidationError::InsufficientConfirmations { .. } => {
                    (actix_web::http::StatusCode::UNPROCESSABLE_ENTITY, e.to_string())
                }
                _ => {
                    (actix_web::http::StatusCode::INTERNAL_SERVER_ERROR, "Internal validation error".to_string())
                }
            };
            HttpResponse::build(status_code).json(serde_json::json!({
                "status": "rejected",
                "reason": reason,
            }))
        }
    }
}
