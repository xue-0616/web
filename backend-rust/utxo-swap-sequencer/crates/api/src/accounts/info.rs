use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use api_common::{
    context::AppContext,
    error::{ApiError, ApiSuccess},
};
use entity_crate::accounts;
use sea_orm::*;
use serde::Serialize;
use utils::oauth_middleware::middleware::JwtClaims;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfoResponse {
    pub id: u64,
    pub lock_hash: String,
    pub wallet_types: Vec<String>,
    pub total_points: u64,
    pub created_at: String,
}

/// GET /api/v1/accounts-auth/info
///
/// Get current user account info. The route is mounted inside the
/// `/accounts-auth` scope which is wrapped by `JwtAuth` middleware
/// (see `crates/api/src/lib.rs`), so by the time we get here a
/// validated `JwtClaims` is in the request extensions. We pull the
/// `account_id` from there — never from the request body and never
/// via an inline `jsonwebtoken::decode`.
///
/// CRIT-SW-3: the old version did its own JWT decode inline using
/// `Validation::default()`, which does not pin the signing algorithm
/// or iss/aud. The shared `JwtAuth` middleware does (see its impl in
/// `utils::oauth_middleware::middleware`), so routing through it
/// gives us a uniform validation surface across every authenticated
/// endpoint. If `JwtClaims` is missing here, the middleware would
/// have rejected the request before we were called — the explicit
/// 401 below is defense-in-depth in case the route is ever
/// re-mounted outside the protected scope by mistake.
pub async fn get_account_info(
    ctx: web::Data<AppContext>,
    req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    let account_id = {
        let extensions = req.extensions();
        let claims = extensions
            .get::<JwtClaims>()
            .ok_or(ApiError::Unauthorized(
                "Missing authentication — endpoint must be mounted behind JwtAuth".to_string(),
            ))?;
        claims.account_id
    };

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
