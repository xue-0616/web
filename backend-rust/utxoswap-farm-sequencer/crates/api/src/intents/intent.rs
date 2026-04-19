use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}};
use entity_crate::farm_intents;
use sea_orm::*;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntentQuery {
    pub tx_hash: Option<String>,
    pub intent_id: Option<u64>,
}

/// GET /api/v1/intents/status
pub async fn get_status(
    ctx: web::Data<AppContext>,
    query: web::Query<IntentQuery>,
) -> Result<HttpResponse, ApiError> {
    let intent = if let Some(id) = query.intent_id {
        farm_intents::Entity::find_by_id(id).one(ctx.db()).await?
    } else if let Some(ref hash) = query.tx_hash {
        let bytes = types::utils::hex_to_bytes(hash)
            .map_err(|e| ApiError::BadRequest(format!("Invalid tx_hash: {}", e)))?;
        farm_intents::Entity::find()
            .filter(farm_intents::Column::CellTxHash.eq(bytes))
            .one(ctx.db())
            .await?
    } else {
        return Err(ApiError::BadRequest("tx_hash or intent_id required".to_string()));
    };

    match intent {
        Some(i) => Ok(ApiSuccess::json(serde_json::json!({
            "intentId": i.id,
            "status": format!("{:?}", i.status),
            "intentType": format!("{:?}", i.intent_type),
            "createdAt": i.created_at.to_string(),
        }))),
        None => Err(ApiError::NotFound("Intent not found".to_string())),
    }
}
