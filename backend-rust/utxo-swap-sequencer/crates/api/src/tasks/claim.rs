use actix_web::{web, HttpResponse, HttpRequest, HttpMessage};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, intents::ClaimTaskRequest};
use entity_crate::{accounts, points_history};
use sea_orm::sea_query::{Expr, OnConflict};
use sea_orm::*;

/// POST /api/v1/tasks/claim
///
/// # Concurrency & TOCTOU safety (HIGH-SW-1)
///
/// The previous implementation had two independent race windows:
///
/// 1. Between the "is the row already in `points_history`?" SELECT
///    and the subsequent INSERT, two concurrent requests for the
///    same `(account_id, task_id)` would both see "not claimed" and
///    both insert — awarding double points.
///
/// 2. Between the `SELECT total_points` read on `accounts` and the
///    `UPDATE total_points = read_value + delta` write, two
///    concurrent claims for the same account (for *different*
///    tasks) would both read the same starting value, both write
///    back `start + delta_a` and `start + delta_b` respectively,
///    and one increment would be silently lost.
///
/// Both are closed by:
///
/// * a UNIQUE index on `(account_id, source_type, source_id)`
///   (migration `m20260420_000000_points_history_unique_claim`),
///   so INSERT is the ground-truth guard — the SELECT is kept
///   only for a nicer 400 response when the index would otherwise
///   produce a 500-looking DbErr;
/// * a single-statement `UPDATE accounts SET total_points =
///   total_points + ?` (atomic at the SQL level);
/// * both operations run inside one sea_orm transaction, so if
///   either fails the whole claim rolls back.
///
/// SECURITY (H-7): `account_id` comes from the JWT, never the body.
pub async fn handler(
    ctx: web::Data<AppContext>,
    http_req: HttpRequest,
    body: web::Json<ClaimTaskRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = body.into_inner();

    let account_id = {
        let extensions = http_req.extensions();
        let claims = extensions
            .get::<utils::oauth_middleware::middleware::JwtClaims>()
            .ok_or(ApiError::Unauthorized("Missing authentication".to_string()))?;
        claims.account_id
    };

    let points_reward = get_task_reward(req.task_id)?;
    let now = chrono::Utc::now().naive_utc();

    let txn = ctx
        .db()
        .begin()
        .await
        .map_err(|e| ApiError::Internal(format!("begin tx: {}", e)))?;

    // 1. Account must exist. We check inside the txn so that a
    //    concurrent account-deletion (unlikely but possible) is
    //    handled consistently with the later UPDATE.
    let account_exists = accounts::Entity::find_by_id(account_id)
        .one(&txn)
        .await?
        .is_some();
    if !account_exists {
        // `txn` drops with rollback when its handle falls out of scope;
        // sea_orm runs the rollback automatically.
        return Err(ApiError::NotFound("Account not found".to_string()));
    }

    // 2. Insert the points-history row. The UNIQUE index on
    //    (account_id, source_type, source_id) is the atomic
    //    guard here — if two concurrent claims race, exactly one
    //    INSERT succeeds, the other hits the conflict branch and
    //    returns 400.
    let history = points_history::ActiveModel {
        account_id: Set(account_id),
        points: Set(points_reward),
        source_type: Set(points_history::SourceType::TaskClaim),
        source_id: Set(req.task_id),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };

    let insert_res = points_history::Entity::insert(history)
        .on_conflict(
            OnConflict::columns([
                points_history::Column::AccountId,
                points_history::Column::SourceType,
                points_history::Column::SourceId,
            ])
            .do_nothing()
            .to_owned(),
        )
        .exec(&txn)
        .await;

    match insert_res {
        Ok(_) => {}
        // sea_orm reports the do-nothing branch as `RecordNotInserted`
        // when no row was actually written. That's the only signal
        // that maps cleanly to "someone else won the race".
        Err(DbErr::RecordNotInserted) => {
            return Err(ApiError::BadRequest("Task already claimed".to_string()));
        }
        Err(e) => return Err(ApiError::Internal(format!("insert points: {}", e))),
    }

    // 3. Atomic delta-update. `total_points = total_points + ?` is
    //    executed as a single SQL statement, so no read-modify-write
    //    window exists on this row anymore.
    accounts::Entity::update_many()
        .col_expr(
            accounts::Column::TotalPoints,
            Expr::col(accounts::Column::TotalPoints).add(points_reward),
        )
        .col_expr(accounts::Column::UpdatedAt, Expr::value(now))
        .filter(accounts::Column::Id.eq(account_id))
        .exec(&txn)
        .await
        .map_err(|e| ApiError::Internal(format!("update total_points: {}", e)))?;

    txn.commit()
        .await
        .map_err(|e| ApiError::Internal(format!("commit tx: {}", e)))?;

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
