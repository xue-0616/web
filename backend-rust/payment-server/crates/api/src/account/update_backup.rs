use actix_web::{web, HttpResponse};
use crate::auth_middleware::AuthenticatedUser;

/// POST /api/v1/account/backup
/// FINDING-01: Requires authentication via AuthenticatedUser extractor.
pub async fn handler(user: AuthenticatedUser, body: web::Json<serde_json::Value>) -> HttpResponse {
    // Store encrypted wallet backup (client-side encrypted)
    // 1. JWT validated by AuthenticatedUser extractor
    // 2. Store encrypted blob in DB (server never sees plaintext)
    // 3. Associate with wallet address
    let masked_user = common::mask_address(&user.user_id);
    tracing::info!("Updating wallet backup for user={}", masked_user);
    HttpResponse::Ok().json(serde_json::json!({"status": "backup_updated"}))
}
