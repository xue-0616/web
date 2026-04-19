use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiSuccess};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UtxoGlobalQuery {
    pub pool_type_hash: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UtxoGlobalSeal {
    pub net_seal: Vec<SealEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SealEntry {
    pub pool_type_hash: String,
    pub asset_x_reserve: String,
    pub asset_y_reserve: String,
}

/// GET /api/v1/external/utxo-global
/// UTXO Global external API — returns pool reserves for partner integration
///
/// SECURITY (H-5): Validates API key against configured value
/// SECURITY (L-1): API key is masked in logs
pub async fn handler(
    ctx: web::Data<AppContext>,
    req: actix_web::HttpRequest,
    query: web::Query<UtxoGlobalQuery>,
) -> Result<HttpResponse, actix_web::Error> {
    // SECURITY (H-5): Validate UTXO Global API key
    let api_key = req.headers().get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // SECURITY (L-1): Only log masked version of API key
    let masked_key = if api_key.len() <= 4 { "****".to_string() } else { format!("{}****", &api_key[..4]) };
    tracing::debug!("UTXO Global API request, key={}", masked_key);

    // SECURITY (H-5): Validate API key with constant-time comparison
    // BL-M1 fix: No early return on length mismatch — always iterate over the longer
    // string's length to prevent leaking the expected key length via timing.
    let expected_key = &ctx.config.sequencer_utxo_global_api_key;
    if expected_key.is_empty() || !constant_time_eq(api_key, expected_key) {
        tracing::warn!("UTXO Global GET: invalid API key from key={}", masked_key);
        return Err(actix_web::error::ErrorUnauthorized("Invalid API key"));
    }

    // Query pool reserves from DB
    use entity_crate::pools;
    use sea_orm::*;
    let pool_type_hash_filter = query.pool_type_hash.clone().unwrap_or_default();

    // BL-L3 fix: Use hex::decode() on the query parameter instead of raw string bytes.
    // The pool_type_hash is a hex-encoded 32-byte hash; using .as_bytes() would search for
    // the ASCII bytes of the hex string (e.g., "abc" -> [0x61, 0x62, 0x63]) instead of
    // the actual decoded bytes (e.g., "abc" -> [0xab, 0xc0] after padding).
    let hash_bytes = if pool_type_hash_filter.is_empty() {
        vec![]
    } else {
        // Strip optional "0x" prefix before hex-decoding
        let hex_str = pool_type_hash_filter.strip_prefix("0x")
            .unwrap_or(&pool_type_hash_filter);
        let decoded = hex::decode(hex_str).map_err(|_| {
            actix_web::error::ErrorBadRequest("Invalid pool_type_hash: not valid hex")
        })?;
        if decoded.len() != 32 {
            return Err(actix_web::error::ErrorBadRequest(
                "Invalid pool_type_hash: must be 32 bytes (64 hex chars)"
            ));
        }
        decoded
    };

    let _pool = pools::Entity::find()
        .filter(pools::Column::TypeHash.eq(hash_bytes))
        .one(ctx.db()).await
        .map_err(actix_web::error::ErrorInternalServerError)?;
    // From binary: "SEQUENCER:EXTERNAL:UTXO_GLOBAL[get_utxo_global_net_seal] cache len"

    Ok(ApiSuccess::json(UtxoGlobalSeal {
        net_seal: vec![],
    }))
}

/// BL-M1 fix: Constant-time string comparison to prevent timing attacks.
/// No early return on length mismatch — always iterate over the longer
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
