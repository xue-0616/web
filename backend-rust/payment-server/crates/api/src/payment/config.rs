use actix_web::HttpResponse;
use crate::auth_middleware::AuthenticatedUser;
/// GET /api/v1/payment/config — payment configuration (merchants, fee tokens)
pub async fn handler(_auth: AuthenticatedUser) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"merchants": ["bitrefill", "wind"]}))
}
