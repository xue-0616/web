use actix_web::{web, HttpResponse};
use api_common::context::AppContext;

/// POST /api/v1/github/upload
pub async fn handler(
    _ctx: web::Data<AppContext>,
) -> Result<HttpResponse, actix_web::Error> {
    // Accept image upload via multipart form data
    // Upload to GitHub repo via API and return URL
    tracing::info!("Image upload requested");
    Ok(HttpResponse::Ok().json(serde_json::json!({"status": "not_implemented"})))
}
