use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, intents::ClaimTaskRequest};
use entity_crate::{accounts, points_history};
use sea_orm::*;

/// POST /api/v1/tasks/claim
///
/// SECURITY (H-7): Account ID is now extracted from JWT token claims,
/// not from the request body. The endpoint is behind JWT auth middleware.
pub async fn handler(
    ctx: web::Data<AppContext>,
    http_req: HttpRequest,
    body: web::Json<ClaimTaskRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = body.into_inner();

    // SECURITY (H-7): Extract account_id from JWT claims instead of request body
    // The JWT middleware inserts claims into request extensions
    let account_id = {
        let extensions = http_req.extensions();
        let claims = extensions.get::<utils::oauth_middleware::middleware::JwtClaims>()
            .ok_or(ApiError::Unauthorized("Missing authentication".to_string()))?;
        claims.account_id
    };

    // 1. Verify account exists — use JWT-derived account_id, ignore request body account_id
    let account = accounts::Entity::find_by_id(account_id)
        .one(ctx.db())
        .await?
        .ok_or(ApiError::NotFound("Account not found".to_string()))?;

    // 2. Check task hasn't been claimed already (using JWT-derived account_id)
    let existing = points_history::Entity::find()
        .filter(points_history::Column::AccountId.eq(account_id))
        .filter(points_history::Column::SourceType.eq(points_history::SourceType::TaskClaim))
        .filter(points_history::Column::SourceId.eq(req.task_id))
        .one(ctx.db())
        .await?;

    if existing.is_some() {
        return Err(ApiError::BadRequest("Task already claimed".to_string()));
    }

    // 3. Determine points reward based on task_id
    let points_reward = get_task_reward(req.task_id)?;

    // 4. Create points history record
    let now = chrono::Utc::now().naive_utc();
    let history = points_history::ActiveModel {
        account_id: Set(account_id),
        points: Set(points_reward),
        source_type: Set(points_history::SourceType::TaskClaim),
        source_id: Set(req.task_id),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };
    history.insert(ctx.db()).await?;

    // 5. Update account total points
    let mut active: accounts::ActiveModel = account.into();
    active.total_points = Set(active.total_points.unwrap() + points_reward);
    active.updated_at = Set(now);
    active.update(ctx.db()).await?;

    Ok(ApiSuccess::json(serde_json::json!({
        "claimed": true,
        "points": points_reward,
    })))
}

fn get_task_reward(task_id: u64) -> Result<u64, ApiError> {
    // Load task definition from config
    let tasks = vec![
        ("swap_first", 50u64, "Complete your first swap"),
        ("swap_10", 200, "Complete 10 swaps"),
        ("add_liq", 100, "Add liquidity to any pool"),
        ("referral", 300, "Refer a friend"),
    ];
    match task_id {
        1 => Ok(100),  // First Swap
        2 => Ok(200),  // Add Liquidity
        3 => Ok(50),   // Daily swap
        _ => Err(ApiError::BadRequest(format!("Unknown task_id: {}", task_id))),
    }
}
