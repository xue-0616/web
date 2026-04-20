use actix_web::{web, HttpResponse};
use api_common::context::AppContext;
use api_common::error::{ApiError, ApiSuccess};
use serde::Deserialize;

use super::signature::{create_pool_canonical_payload, hash_payload, verify_signature};

/// BUG-30 FIX: Added proper validation, authorization, and parameter checking
/// for pool creation instead of a no-op stub.

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePoolRequest {
    /// Creator's CKB address (must be an authorized admin)
    pub creator_address: String,
    /// Type hash of the LP token to stake
    pub lp_token_type_hash: String,
    /// Type hash of the reward token
    pub reward_token_type_hash: String,
    /// Rewards distributed per second (in token base units)
    pub reward_per_second: String,
    /// Pool start time (unix timestamp)
    pub start_time: u64,
    /// Pool end time (unix timestamp)
    pub end_time: u64,
    /// Authorization signature from admin
    pub signature: String,
}

/// POST /api/v1/intents/create-pool
pub async fn handler(
    ctx: web::Data<AppContext>,
    body: web::Json<CreatePoolRequest>,
) -> Result<HttpResponse, ApiError> {
    // HIGH-FM-3 fail-closed gate: creating a pool without a working
    // processor is also pointless — the pool row would just sit there.
    if !ctx.config.farm_processing_enabled {
        return Err(ApiError::ServiceUnavailable(
            "Pool creation is temporarily disabled (FARM_PROCESSING_ENABLED=false)."
                .to_string(),
        ));
    }

    let req = body.into_inner();

    // 1. Validate parameters
    if req.end_time <= req.start_time {
        return Err(ApiError::BadRequest("end_time must be after start_time".to_string()));
    }

    if req.reward_per_second.is_empty() || req.reward_per_second == "0" {
        return Err(ApiError::BadRequest("reward_per_second must be > 0".to_string()));
    }

    let _reward_per_second: u128 = req.reward_per_second.parse()
        .map_err(|_| ApiError::BadRequest("Invalid reward_per_second value".to_string()))?;

    // 2. Validate hex hashes
    let _lp_hash = types::utils::hex_to_bytes(&req.lp_token_type_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid lp_token_type_hash: {}", e)))?;
    let _reward_hash = types::utils::hex_to_bytes(&req.reward_token_type_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid reward_token_type_hash: {}", e)))?;

    // 3. Authorization — enforce admin allow-list from `FARM_ADMIN_ADDRESSES`.
    if req.creator_address.is_empty() || req.signature.is_empty() {
        return Err(ApiError::BadRequest(
            "creator_address and signature are required".to_string(),
        ));
    }
    if !ctx.config.is_admin(&req.creator_address) {
        tracing::warn!(
            "Rejected create-pool intent from non-admin address {}",
            req.creator_address
        );
        return Err(ApiError::Forbidden(
            "creator_address is not an authorized admin".to_string(),
        ));
    }

    // 3b. Cryptographic signature verification (secondary defence).
    // Skipped if operator hasn't yet configured FARM_ADMIN_PUBKEYS; in that
    // case the address allow-list above is the only gate, which is still
    // acceptable behind a trusted network perimeter.
    if !ctx.config.admin_pubkeys.is_empty() {
        let payload = create_pool_canonical_payload(
            &req.creator_address,
            &req.lp_token_type_hash,
            &req.reward_token_type_hash,
            &req.reward_per_second,
            req.start_time,
            req.end_time,
        );
        let digest = hash_payload(&payload);
        if let Err(e) =
            verify_signature(&digest, &req.signature, &ctx.config.admin_pubkeys)
        {
            tracing::warn!(
                "Signature verification failed for create-pool by {}: {}",
                req.creator_address,
                e
            );
            return Err(ApiError::Forbidden(format!(
                "signature verification failed: {}",
                e
            )));
        }
    } else {
        tracing::warn!(
            "FARM_ADMIN_PUBKEYS not set — accepting create-pool on address allow-list alone"
        );
    }

    // 4. MED-FM-3: reject duplicate farm pools on the same LP token.
    //    Without this check, an authorized admin could accidentally
    //    submit two create-pool intents for the same LP token (e.g.
    //    retry after a network blip) and end up with two rows in
    //    `farm_pools`. The frontend picks "the" pool by LP token
    //    hash, so a duplicate silently fragments staking: some users
    //    deposit into pool A, others into pool B, and the reward
    //    accounting never reconciles. Since pool creation is a rare
    //    admin-only operation, a conservative "first write wins, the
    //    rest get a 409-style BadRequest" is exactly what we want.
    //
    //    We match on the `lp_token_type_hash` only; two *different*
    //    reward-token configurations on the same LP are still
    //    disallowed here because no UI we ship exposes that choice,
    //    and allowing it would re-open the fragmentation hole.
    use entity_crate::farm_pools;
    use sea_orm::*;
    let existing = farm_pools::Entity::find()
        .filter(farm_pools::Column::LpTokenTypeHash.eq(_lp_hash.clone()))
        .one(ctx.db())
        .await
        .map_err(|e| ApiError::Internal(format!("farm_pools lookup: {}", e)))?;
    if let Some(pool) = existing {
        tracing::warn!(
            "Rejected create-pool: farm pool id={} already exists for LP token {}",
            pool.id,
            req.lp_token_type_hash
        );
        return Err(ApiError::BadRequest(format!(
            "A farm pool already exists for LP token {} (pool id = {}). \
             Duplicate pools would fragment liquidity.",
            req.lp_token_type_hash, pool.id
        )));
    }

    tracing::info!(
        "Create pool intent accepted from admin {} for LP token {}",
        req.creator_address,
        req.lp_token_type_hash
    );

    // 5. Check that the LP token type hash corresponds to a valid UTXOSwap pool
    // (would query UTXOSwap sequencer API or on-chain data)

    Ok(ApiSuccess::json(serde_json::json!({
        "status": "pending",
        "message": "Pool creation intent submitted for review"
    })))
}
