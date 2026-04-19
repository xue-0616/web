use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}, intents::SendIntentTxRequest};

/// POST /api/v1/intents/add-liquidity
/// Submit an add liquidity intent
pub async fn handler(
    ctx: web::Data<AppContext>,
    body: web::Json<SendIntentTxRequest>,
) -> Result<HttpResponse, ApiError> {
    let _req = body.into_inner();
    // Add liquidity intent flow:
    // 1. Parse CKB transaction hex to extract intent cell data
    // 2. Validate: pool exists, amounts > 0, user has sufficient balance
    // 3. Calculate expected LP token output: lp_amount = min(dx * total_lp / reserve_x, dy * total_lp / reserve_y)
    // 4. Submit CKB transaction via RPC (passthrough)
    // 5. Store intent in DB with intent_type = AddLiquidity
    use entity_crate::intents;
    use sea_orm::*;
    tracing::info!("Processing add liquidity intent");
    Err(ApiError::Internal("Not yet implemented".to_string()))
}
