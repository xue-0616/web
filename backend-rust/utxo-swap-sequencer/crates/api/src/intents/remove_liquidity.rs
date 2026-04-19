use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, intents::SendIntentTxRequest};

/// POST /api/v1/intents/remove-liquidity
/// Submit a remove liquidity intent
pub async fn handler(
    ctx: web::Data<AppContext>,
    body: web::Json<SendIntentTxRequest>,
) -> Result<HttpResponse, ApiError> {
    let _req = body.into_inner();
    // Remove liquidity intent flow:
    // 1. Parse CKB transaction hex to extract intent cell data
    // 2. Validate: pool exists, LP amount > 0, user owns LP tokens
    // 3. Calculate expected outputs: x_out = lp_amount * reserve_x / total_lp, y_out = lp_amount * reserve_y / total_lp
    // 4. Submit CKB transaction via RPC (passthrough)
    // 5. Store intent in DB with intent_type = RemoveLiquidity
    use entity_crate::intents;
    use sea_orm::*;
    tracing::info!("Processing remove liquidity intent");
    Err(ApiError::Internal("Not yet implemented".to_string()))
}
