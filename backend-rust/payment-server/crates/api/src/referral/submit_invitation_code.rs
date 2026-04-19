use actix_web::{web, HttpResponse};
use crate::auth_middleware::AuthenticatedUser;
/// POST /api/v1/referral/submit-code
pub async fn handler(_auth: AuthenticatedUser, body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}
