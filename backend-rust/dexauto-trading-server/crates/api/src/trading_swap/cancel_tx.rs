use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use api_common::{context::AppContext, security::AuthenticatedUser};
use entity_crate::trading_transactions;
use sea_orm::*;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelRequest {
    pub order_id: String,
}

/// POST /api/v1/trading/cancel
pub async fn handler(
    req_http: HttpRequest,
    ctx: web::Data<AppContext>,
    body: web::Json<CancelRequest>,
) -> actix_web::Result<HttpResponse> {
    // --- Auth: extract authenticated user from middleware ---
    let auth_user = req_http
        .extensions()
        .get::<AuthenticatedUser>()
        .cloned()
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Authentication required"))?;

    let tx = trading_transactions::Entity::find()
        .filter(trading_transactions::Column::OrderId.eq(&body.order_id))
        .one(ctx.db())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    match tx {
        Some(t) => {
            // --- Ownership check: only the creator can cancel (IDOR fix) ---
            if t.user_id != auth_user.user_id {
                return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                    "error": "You do not own this order"
                })));
            }

            // --- Status guard: only allow cancelling Pending orders ---
            if t.status != trading_transactions::TxStatus::Pending {
                return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                    "error": format!("Cannot cancel order in {:?} status", t.status)
                })));
            }

            let mut am: trading_transactions::ActiveModel = t.into();
            am.status = Set(trading_transactions::TxStatus::Cancelled);
            am.updated_at = Set(chrono::Utc::now().naive_utc());
            trading_transactions::Entity::update(am)
                .exec(ctx.db())
                .await
                .map_err(actix_web::error::ErrorInternalServerError)?;
            Ok(HttpResponse::Ok().json(serde_json::json!({"status": "cancelled"})))
        }
        None => Ok(HttpResponse::NotFound().json(serde_json::json!({"error": "Order not found"}))),
    }
}
