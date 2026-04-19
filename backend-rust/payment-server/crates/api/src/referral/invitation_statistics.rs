use actix_web::{web, HttpResponse};
use crate::auth_middleware::AuthenticatedUser;
/// GET /api/v1/referral/statistics
pub async fn handler(_auth: AuthenticatedUser, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"invited": 0, "rewards": "0"}))
}
