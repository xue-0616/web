use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use api_common::{context::AppContext, security::AuthenticatedUser};
use entity_crate::operator_keys;
use sea_orm::*;

/// GET /api/v1/op-key/list
///
/// Lists operator keys belonging to the authenticated user only.
/// The userId is derived from the auth middleware — no longer accepted as a query parameter
/// to prevent IDOR (Insecure Direct Object Reference).
pub async fn handler(
    req_http: HttpRequest,
    ctx: web::Data<AppContext>,
) -> actix_web::Result<HttpResponse> {
    // --- Auth: derive userId from middleware (IDOR fix) ---
    let auth_user = req_http
        .extensions()
        .get::<AuthenticatedUser>()
        .cloned()
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Authentication required"))?;

    let keys = operator_keys::Entity::find()
        .filter(operator_keys::Column::UserId.eq(&auth_user.user_id))
        .all(ctx.db())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let results: Vec<api_common::operator_key::OperatorKeyResponse> = keys.into_iter().map(|k| {
        api_common::operator_key::OperatorKeyResponse {
            id: k.id,
            trading_account_pda: k.trading_account_pda,
            max_priority_fee: k.max_priority_fee,
            is_active: k.is_active,
        }
    }).collect();

    Ok(HttpResponse::Ok().json(serde_json::json!({ "data": results })))
}
