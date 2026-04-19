use actix_web::{web, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, ApiSuccess},
    intents::{GetIntentTxRequest, IntentStatusResponse},
};
use entity_crate::intents;
use sea_orm::*;

/// GET /api/v1/intents/status?txHash=0x...
/// Query intent status by transaction hash
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<GetIntentTxRequest>,
) -> Result<HttpResponse, ApiError> {
    let tx_hash = types::utils::hex_to_bytes(&query.tx_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid tx_hash: {}", e)))?;

    let intent = intents::Entity::find()
        .filter(intents::Column::CellTxHash.eq(tx_hash.clone()))
        .one(ctx.db())
        .await?
        .ok_or(ApiError::NotFound("Intent not found".to_string()))?;

    let pool_tx_hash = intent.pool_tx_hash.as_ref().map(|h| hex::encode(h));

    Ok(ApiSuccess::json(IntentStatusResponse {
        intent_id: intent.id,
        status: format!("{:?}", intent.status),
        tx_hash: hex::encode(&intent.cell_tx_hash),
        pool_tx_hash,
        error_reason: intent.error_reason.clone(),
        created_at: intent.created_at.to_string(),
        updated_at: intent.updated_at.to_string(),
    }))
}
