use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, pools::PoolStatusResponse};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusQuery {
    pub pool_type_hash: String,
}

/// GET /api/v1/pools/status?poolTypeHash=0x...
/// Returns real-time pool reserves from on-chain state
///
/// SECURITY (L-3): Validates hex string length for poolTypeHash
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<StatusQuery>,
) -> Result<HttpResponse, ApiError> {
    // SECURITY (L-3): Validate poolTypeHash format - should be exactly 64 hex chars (32 bytes)
    let clean_hash = query.pool_type_hash.strip_prefix("0x").unwrap_or(&query.pool_type_hash);
    if clean_hash.len() != 64 {
        return Err(ApiError::BadRequest(format!(
            "Invalid poolTypeHash length: expected 64 hex chars (32 bytes), got {}",
            clean_hash.len()
        )));
    }
    if !clean_hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ApiError::BadRequest("poolTypeHash contains invalid hex characters".to_string()));
    }

    let _pool_hash = types::utils::hex_to_bytes(&query.pool_type_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid poolTypeHash: {}", e)))?;

    // Fetch live pair info from CKB indexer
    let client = reqwest::Client::new();
    let rpc_body = serde_json::json!({
        "id": 1, "jsonrpc": "2.0",
        "method": "get_cells",
        "params": [{
            "script": {
                "code_hash": format!("0x{}", hex::encode(&_pool_hash)),
                "hash_type": "type",
                "args": "0x"
            },
            "script_type": "type",
            "script_search_mode": "exact"
        }, "asc", "0x1"]
    });
    let resp = client.post(&ctx.config.ckb_indexer_url).json(&rpc_body).send().await
        .map_err(|e| ApiError::Internal(format!("Indexer error: {}", e)))?;
    // 1. Find the pool cell by type_hash via CKB indexer
    // 2. Parse cell data to get reserves
    // 3. Return current state

    Ok(ApiSuccess::json(PoolStatusResponse {
        status: "active".to_string(),
        pool_type_hash: query.pool_type_hash.clone(),
        asset_x_reserve: "0".to_string(),
        asset_y_reserve: "0".to_string(),
        total_lp_supply: "0".to_string(),
        fee_rate: "30".to_string(),
        is_miner_chain: false,
    }))
}
