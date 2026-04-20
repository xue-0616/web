use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiError, intents::SendIntentTxRequest};

/// POST /api/v1/intents/add-liquidity
/// Submit an add liquidity intent
pub async fn handler(
    _ctx: web::Data<AppContext>,
    body: web::Json<SendIntentTxRequest>,
) -> Result<HttpResponse, ApiError> {
    let _req = body.into_inner();
    // Add liquidity intent flow (TODO — MED-SW-1 stub):
    //   1. Parse CKB transaction hex to extract intent cell data
    //   2. Validate pool exists, amounts > 0, user has sufficient balance
    //   3. Calculate expected LP: lp = min(dx * total_lp / reserve_x,
    //      dy * total_lp / reserve_y)
    //   4. Submit CKB transaction via RPC (passthrough)
    //   5. Store intent in DB with intent_type = AddLiquidity
    tracing::info!("Processing add liquidity intent (stub)");
    Err(ApiError::NotImplemented(
        "add-liquidity intent submission is not yet wired up".to_string(),
    ))
}
