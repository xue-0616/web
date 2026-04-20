use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiError, intents::SendIntentTxRequest};

/// POST /api/v1/intents/remove-liquidity
/// Submit a remove liquidity intent
pub async fn handler(
    _ctx: web::Data<AppContext>,
    body: web::Json<SendIntentTxRequest>,
) -> Result<HttpResponse, ApiError> {
    let _req = body.into_inner();
    // Remove liquidity intent flow (TODO — MED-SW-1 stub):
    //   1. Parse CKB transaction hex to extract intent cell data
    //   2. Validate pool exists, LP amount > 0, user owns LP tokens
    //   3. Outputs: x_out = lp * reserve_x / total_lp,
    //      y_out = lp * reserve_y / total_lp
    //   4. Submit CKB transaction via RPC (passthrough)
    //   5. Store intent in DB with intent_type = RemoveLiquidity
    tracing::info!("Processing remove liquidity intent (stub)");
    Err(ApiError::NotImplemented(
        "remove-liquidity intent submission is not yet wired up".to_string(),
    ))
}
