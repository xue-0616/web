use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}};
use entity_crate::farm_pools;
use sea_orm::*;

/// GET /api/v1/pools
pub async fn handler(ctx: web::Data<AppContext>) -> Result<HttpResponse, ApiError> {
    let pools = farm_pools::Entity::find()
        .order_by_desc(farm_pools::Column::CreatedAt)
        .all(ctx.db())
        .await?;

    let results: Vec<serde_json::Value> = pools.into_iter().map(|p| {
        serde_json::json!({
            "id": p.id,
            "farmTypeHash": hex::encode(&p.farm_type_hash),
            "poolTypeHash": hex::encode(&p.pool_type_hash),
            "totalStaked": p.total_staked.to_string(),
            "rewardPerSecond": p.reward_per_second.to_string(),
            "status": format!("{:?}", p.status),
            "startTime": p.start_time.to_string(),
            "endTime": p.end_time.to_string(),
        })
    }).collect();

    Ok(ApiSuccess::json(results))
}
