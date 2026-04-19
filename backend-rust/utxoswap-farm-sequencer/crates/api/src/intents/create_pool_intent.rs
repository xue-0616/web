use actix_web::{web, HttpResponse};
use api_common::context::AppContext;
use api_common::error::{ApiError, ApiSuccess};
use entity_crate::farm_intents::{self, FarmIntentType};
use sea_orm::*;
use serde::Deserialize;

/// BUG-30 FIX: Added proper validation and parameter checking for pool creation
/// query endpoint (different from submit — this one queries status of a pending
/// pool creation intent).

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetCreatePoolIntentRequest {
    /// The farm type hash to look up
    pub farm_type_hash: Option<String>,
    /// Creator address filter
    pub creator_address: Option<String>,
}

/// GET /api/v1/intents/create-pool
/// Query the status of pool creation intents
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<GetCreatePoolIntentRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = query.into_inner();

    // Validate + decode input filters.
    let farm_hash_bytes = if let Some(ref hash) = req.farm_type_hash {
        Some(
            types::utils::hex_to_bytes(hash)
                .map_err(|e| ApiError::BadRequest(format!("Invalid farm_type_hash: {}", e)))?,
        )
    } else {
        None
    };

    // `creator_address` is treated as a hex-encoded lock_hash (32 bytes).
    // CKB-address decoding is intentionally out-of-scope here; callers
    // typically already know the lock_hash they care about.
    let creator_lock_hash = if let Some(ref addr) = req.creator_address {
        Some(
            types::utils::hex_to_bytes(addr.trim_start_matches("0x"))
                .map_err(|e| ApiError::BadRequest(format!("Invalid creator_address (expected hex lock_hash): {}", e)))?,
        )
    } else {
        None
    };

    if farm_hash_bytes.is_none() && creator_lock_hash.is_none() {
        return Err(ApiError::BadRequest(
            "At least one of farm_type_hash or creator_address is required".to_string(),
        ));
    }

    tracing::info!(
        "Create pool intent query: farm_hash={:?}, creator={:?}",
        req.farm_type_hash,
        req.creator_address
    );

    // Query DB for matching CreatePool intents.
    let mut q = farm_intents::Entity::find()
        .filter(farm_intents::Column::IntentType.eq(FarmIntentType::CreatePool));
    if let Some(ref h) = farm_hash_bytes {
        q = q.filter(farm_intents::Column::FarmTypeHash.eq(h.clone()));
    }
    if let Some(ref lh) = creator_lock_hash {
        q = q.filter(farm_intents::Column::LockHash.eq(lh.clone()));
    }
    let rows = q
        .order_by_desc(farm_intents::Column::CreatedAt)
        .limit(50)
        .all(ctx.db())
        .await
        .map_err(|e| ApiError::Internal(format!("DB query failed: {}", e)))?;

    let intents: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id,
                "farm_type_hash": format!("0x{}", hex::encode(&r.farm_type_hash)),
                "cell_tx_hash": format!("0x{}", hex::encode(&r.cell_tx_hash)),
                "cell_index": r.cell_index,
                "lock_hash": format!("0x{}", hex::encode(&r.lock_hash)),
                "amount": r.amount.to_string(),
                "status": format!("{:?}", r.status),
                "batch_tx_hash": r.batch_tx_hash.as_ref().map(|b| format!("0x{}", hex::encode(b))),
                "error_reason": r.error_reason,
                "created_at": r.created_at.and_utc().to_rfc3339(),
                "updated_at": r.updated_at.and_utc().to_rfc3339(),
            })
        })
        .collect();

    let message = if intents.is_empty() {
        "No matching pool creation intents found"
    } else {
        "ok"
    };
    Ok(ApiSuccess::json(serde_json::json!({
        "intents": intents,
        "count": intents.len(),
        "message": message,
    })))
}
