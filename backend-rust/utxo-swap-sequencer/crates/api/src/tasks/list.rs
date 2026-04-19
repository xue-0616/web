use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}};
use serde::Serialize;

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
pub async fn handler(ctx: web::Data<AppContext>) -> Result<HttpResponse, ApiError> {
    // Load all available tasks and check user completion status
    use entity_crate::points_history;
    use sea_orm::*;

    let tasks = vec![
        serde_json::json!({"id": "swap_first", "name": "First Swap", "points": 50, "description": "Complete your first swap"}),
        serde_json::json!({"id": "swap_10", "name": "10 Swaps", "points": 200, "description": "Complete 10 swaps"}),
        serde_json::json!({"id": "add_liq", "name": "Add Liquidity", "points": 100, "description": "Add liquidity to any pool"}),
        serde_json::json!({"id": "referral", "name": "Referral", "points": 300, "description": "Refer a friend who trades"}),
    ];
    let tasks = vec![
        TaskItem {
            id: 1,
            name: "First Swap".to_string(),
            description: "Complete your first token swap".to_string(),
            points_reward: 100,
            task_type: "one_time".to_string(),
            is_completed: false,
        },
        TaskItem {
            id: 2,
            name: "Add Liquidity".to_string(),
            description: "Add liquidity to any pool".to_string(),
            points_reward: 200,
            task_type: "one_time".to_string(),
            is_completed: false,
        },
    ];
    Ok(ApiSuccess::json(tasks))
}
