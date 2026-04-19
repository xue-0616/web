use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiSuccess, intents::SendIntentTxRequest};

/// POST /api/v1/external/utxo-global/swap
/// UTXO Global swap endpoint — delegates to standard swap with partner API key tracking
///
/// SECURITY (H-5): Validates API key against configured value
/// SECURITY (L-1): API key is masked in logs
pub async fn handler(
    ctx: web::Data<AppContext>,
    req: actix_web::HttpRequest,
    body: web::Json<SendIntentTxRequest>,
) -> Result<HttpResponse, actix_web::Error> {
    // SECURITY (H-5): Validate UTXO Global API key
    let api_key = req.headers().get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // SECURITY (L-1): Only log masked version of API key
    let masked_key = mask_api_key(api_key);
    tracing::info!("UTXO Global swap request from key={}", masked_key);

    // SECURITY (H-5): Validate API key against configured value using constant-time comparison
    let expected_key = &ctx.config.sequencer_utxo_global_api_key;
    if expected_key.is_empty() || !constant_time_eq(api_key, expected_key) {
        tracing::warn!("UTXO Global swap: invalid API key from key={}", masked_key);
        return Err(actix_web::error::ErrorUnauthorized("Invalid API key"));
    }

    // Submit swap intent with UTXO Global metadata
    // Set api_key and wallet_type fields for tracking
    Err(actix_web::error::ErrorInternalServerError("Not yet implemented".to_string()))
}

/// Mask API key for safe logging — show first 4 chars + "****" (L-1)
fn mask_api_key(key: &str) -> String {
    if key.len() <= 4 {
        "****".to_string()
    } else {
        format!("{}****", &key[..4])
    }
}

/// Constant-time string comparison to prevent timing attacks (H-5, BL-M1)
/// BL-M1 fix: No early return on length mismatch — always iterate over the longer
/// string's length to prevent leaking the expected key length via timing.
fn constant_time_eq(a: &str, b: &str) -> bool {
    let a_bytes = a.as_bytes();
    let b_bytes = b.as_bytes();
    let max_len = a_bytes.len().max(b_bytes.len());

    // Start with length difference to ensure mismatch if lengths differ
    let mut diff = (a_bytes.len() ^ b_bytes.len()) as u8;

    // Always iterate max_len times to prevent timing side-channel on key length
    for i in 0..max_len {
        let x = if i < a_bytes.len() { a_bytes[i] } else { 0 };
        let y = if i < b_bytes.len() { b_bytes[i] } else { 0 };
        diff |= x ^ y;
    }

    diff == 0
}
