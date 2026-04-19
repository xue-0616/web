use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, pools::PoolInfoRequest};
use entity_crate::pools;
use sea_orm::*;

/// GET /api/v1/pools/by-tokens?assetXTypeHash=0x...&assetYTypeHash=0x...
pub async fn handler(
    ctx: web::Data<AppContext>,
    query: web::Query<PoolInfoRequest>,
) -> Result<HttpResponse, ApiError> {
    let x_hash = types::utils::hex_to_bytes(&query.asset_x_type_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid assetXTypeHash: {}", e)))?;
    let y_hash = types::utils::hex_to_bytes(&query.asset_y_type_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid assetYTypeHash: {}", e)))?;

    let pool = pools::Entity::find()
        .filter(
            Condition::any()
                .add(
                    Condition::all()
                        .add(pools::Column::AssetXTypeHash.eq(x_hash.clone()))
                        .add(pools::Column::AssetYTypeHash.eq(y_hash.clone())),
                )
                .add(
                    Condition::all()
                        .add(pools::Column::AssetXTypeHash.eq(y_hash.clone()))
                        .add(pools::Column::AssetYTypeHash.eq(x_hash.clone())),
                ),
        )
        .one(ctx.db())
        .await?
        .ok_or(ApiError::NotFound("Pool not found for this token pair".to_string()))?;

    Ok(ApiSuccess::json(serde_json::json!({
        "id": pool.id,
        "poolTypeHash": hex::encode(&pool.type_hash),
        "assetXTypeHash": hex::encode(&pool.asset_x_type_hash),
        "assetYTypeHash": hex::encode(&pool.asset_y_type_hash),
        "tvl": pool.tvl.map(|v| v.to_string()),
    })))
}
