use actix_web::{web, HttpRequest, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, ApiSuccess},
};
use entity_crate::accounts;
use sea_orm::*;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfoResponse {
    pub id: u64,
    pub lock_hash: String,
    pub wallet_types: Vec<String>,
    pub total_points: u64,
    pub created_at: String,
}

/// GET /api/v1/accounts/info
/// Get current user account info (JWT required)
pub async fn get_account_info(
    ctx: web::Data<AppContext>,
    req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    let account_id = extract_account_id(&req, &ctx)?;

    let account = accounts::Entity::find_by_id(account_id)
        .one(ctx.db())
        .await?
        .ok_or(ApiError::NotFound("Account not found".to_string()))?;

    Ok(ApiSuccess::json(AccountInfoResponse {
        id: account.id,
        lock_hash: hex::encode(&account.lock_hash),
        wallet_types: account.wallet_types.split(',').map(|s| s.to_string()).collect(),
        total_points: account.total_points,
        created_at: account.created_at.to_string(),
    }))
}

/// Extract account_id from JWT Authorization header
fn extract_account_id(req: &HttpRequest, ctx: &AppContext) -> Result<u64, ApiError> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(ApiError::Unauthorized("Missing Authorization header".to_string()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(ApiError::Unauthorized("Invalid token format".to_string()))?;

    let token_data = jsonwebtoken::decode::<serde_json::Value>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(ctx.config.jwt_secret.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map_err(|e| ApiError::Unauthorized(format!("Invalid token: {}", e)))?;

    token_data
        .claims
        .get("account_id")
        .and_then(|v| v.as_u64())
        .ok_or(ApiError::Unauthorized("Invalid token claims".to_string()))
}
