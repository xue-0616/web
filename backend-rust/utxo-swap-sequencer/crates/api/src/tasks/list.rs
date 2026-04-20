use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}};
use entity_crate::points_history;
use sea_orm::*;
use serde::Serialize;
use utils::oauth_middleware::middleware::JwtClaims;

use super::catalog::{Task, CLAIM_SOURCE_TYPE, TASKS};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskItem {
    pub id: u64,
    pub name: String,
    pub description: String,
    pub points_reward: u64,
    pub task_type: String,
    pub is_completed: bool,
}

/// GET /api/v1/tasks
///
/// HIGH-SW-3: the previous handler returned a hard-coded
/// `is_completed: false` for every task and ignored the requesting
/// user entirely. It also kept two duplicated `let tasks = vec![..]`
/// blocks (one shadowing the other) with reward numbers that
/// disagreed with `tasks/claim.rs`.
///
/// This handler now:
///
///   * pulls the canonical list from `super::catalog::TASKS`, so it
///     can never drift from `claim.rs`'s reward table again
///     (HIGH-SW-2 was the same drift class);
///   * if the request carries a valid JWT (the route is mounted in
///     a scope that opportunistically attaches `JwtAuth`), checks
///     `points_history` for each task id and sets `is_completed`
///     accordingly;
///   * if there's no JWT (anonymous browsing), returns the catalog
///     with `is_completed: false` everywhere — matching the old
///     behaviour for unauthenticated callers.
///
/// The completion lookup is one indexed query against
/// `(account_id, source_type, source_id)`, which is exactly the
/// UNIQUE index the HIGH-SW-1 fix added — so this is essentially
/// free.
pub async fn handler(
    ctx: web::Data<AppContext>,
    req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    // Try to identify the caller. Missing claims is *not* an error
    // for this endpoint — the catalog is public; only the
    // per-user completion column needs auth.
    let account_id: Option<u64> = {
        let extensions = req.extensions();
        extensions.get::<JwtClaims>().map(|c| c.account_id)
    };

    let completed_ids: std::collections::HashSet<u64> = match account_id {
        Some(aid) => points_history::Entity::find()
            .select_only()
            .column(points_history::Column::SourceId)
            .filter(points_history::Column::AccountId.eq(aid))
            .filter(points_history::Column::SourceType.eq(CLAIM_SOURCE_TYPE))
            .filter(
                points_history::Column::SourceId
                    .is_in(TASKS.iter().map(|t| t.id).collect::<Vec<_>>()),
            )
            .into_tuple::<u64>()
            .all(ctx.db())
            .await?
            .into_iter()
            .collect(),
        None => std::collections::HashSet::new(),
    };

    let items: Vec<TaskItem> = TASKS.iter().map(|t: &Task| TaskItem {
        id: t.id,
        name: t.name.to_string(),
        description: t.description.to_string(),
        points_reward: t.points_reward,
        task_type: t.task_type.to_string(),
        is_completed: completed_ids.contains(&t.id),
    }).collect();

    Ok(ApiSuccess::json(items))
}
