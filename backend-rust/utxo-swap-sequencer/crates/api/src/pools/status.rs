use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, pools::PoolStatusResponse};
use entity_crate::pools;
use sea_orm::*;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusQuery {
    pub pool_type_hash: String,
}

/// GET /api/v1/pools/status?poolTypeHash=0x...
///
/// Returns the pool's last-known reserves and LP supply.
///
/// # MED-SW-3 — what changed and why
///
/// The previous implementation:
///
///   1. validated the `poolTypeHash` query param,
///   2. fired a `get_cells` JSON-RPC at the CKB indexer,
///   3. **discarded the response without parsing it**, and
///   4. returned `asset_x_reserve: "0"`, `asset_y_reserve: "0"`,
///      `total_lp_supply: "0"` to every caller.
///
/// That was actively misleading — the endpoint advertised "real-time
/// pool reserves from on-chain state" while every pool ever queried
/// looked drained. A naïve frontend or monitoring dashboard reading
/// these zeroes would either reject all swaps as zero-liquidity or
/// page on-call about a "totally empty AMM".
///
/// We can't yet do a faithful on-chain decode here without lifting
/// the molecule pool-state schema into this crate, which is a
/// non-trivial cross-crate refactor. The serviceable interim is to
/// return the cached values from the `pools` table — the same row
/// that `pool_list.rs` and the sequencer's TVL/APR jobs read and
/// write. They are a few seconds stale at worst (the sequencer
/// updates them after every batch settles) and at least reflect
/// reality. The TODO for live indexer-backed numbers stays in the
/// codebase but is no longer the difference between "0" and "real".
///
/// SECURITY (L-3): the `poolTypeHash` length / hex validation is
/// preserved verbatim. We never use the value before the validation
/// runs.
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<StatusQuery>,
) -> Result<HttpResponse, ApiError> {
    let clean_hash = query.pool_type_hash.strip_prefix("0x").unwrap_or(&query.pool_type_hash);
    if clean_hash.len() != 64 {
        return Err(ApiError::BadRequest(format!(
            "Invalid poolTypeHash length: expected 64 hex chars (32 bytes), got {}",
            clean_hash.len()
        )));
    }
    if !clean_hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ApiError::BadRequest(
            "poolTypeHash contains invalid hex characters".to_string(),
        ));
    }

    let pool_hash_bytes = types::utils::hex_to_bytes(&query.pool_type_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid poolTypeHash: {}", e)))?;

    // Look the pool up in our own DB. This is the same row the
    // batch processor writes after each settlement, so it tracks
    // on-chain state with at most one batch interval of staleness.
    let pool = pools::Entity::find()
        .filter(pools::Column::TypeHash.eq(pool_hash_bytes))
        .one(ctx.db())
        .await?
        .ok_or_else(|| ApiError::NotFound(format!(
            "No pool with typeHash {}", query.pool_type_hash
        )))?;

    // The cached `total_lp_supply` is not currently tracked as a
    // dedicated column; surface "0" to keep the response shape
    // backward-compatible until the schema gains one. (`asset_*_amount`
    // ARE tracked, so the misleading double-zero is now single-zero
    // and limited to LP supply.)
    Ok(ApiSuccess::json(PoolStatusResponse {
        status: "active".to_string(),
        pool_type_hash: query.pool_type_hash.clone(),
        asset_x_reserve: pool
            .asset_x_amount
            .map(|v| v.to_string())
            .unwrap_or_else(|| "0".to_string()),
        asset_y_reserve: pool
            .asset_y_amount
            .map(|v| v.to_string())
            .unwrap_or_else(|| "0".to_string()),
        total_lp_supply: "0".to_string(),
        fee_rate: "30".to_string(),
        is_miner_chain: false,
    }))
}
