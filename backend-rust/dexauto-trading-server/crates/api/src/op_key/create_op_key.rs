use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use api_common::{context::AppContext, operator_key::CreateOpKeyRequest, security::AuthenticatedUser};

/// POST /api/v1/op-key/create
pub async fn handler(
    req_http: HttpRequest,
    _ctx: web::Data<AppContext>,
    body: web::Json<CreateOpKeyRequest>,
) -> actix_web::Result<HttpResponse> {
    // --- Auth: extract authenticated user from middleware ---
    let auth_user = req_http
        .extensions()
        .get::<AuthenticatedUser>()
        .cloned()
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Authentication required"))?;

    let req = body.into_inner();

    // Enforce: the user_id in the request body must match the authenticated user
    if req.user_id != auth_user.user_id {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Cannot create operator key for a different user"
        })));
    }

    // 1. Generate Solana keypair
    // 2. Derive trading account PDA
    // 3. Encrypt private key with AWS KMS
    // 4. Store in DB
    // 5. Return PDA
    tracing::info!("Creating operator key for user: {}", req.user_id);
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "created",
        "userId": req.user_id,
    })))
}
