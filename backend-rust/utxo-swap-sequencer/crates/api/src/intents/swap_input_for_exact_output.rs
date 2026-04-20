use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiError, intents::SendIntentTxRequest};

/// POST /api/v1/intents/swap-input-for-exact-output
/// Submit a swap intent with exact output amount
pub async fn handler(
    _ctx: web::Data<AppContext>,
    body: web::Json<SendIntentTxRequest>,
) -> Result<HttpResponse, ApiError> {
    // Same flow as swap_exact_input_for_output but with IntentType::SwapInputForExactOutput
    // The intent-solver will calculate the required input amount
    let _req = body.into_inner();
    // Swap input for exact output:
    // Calculate required input: amount_in = (reserve_in * amount_out * 10000) / ((reserve_out - amount_out) * (10000 - fee_bps)) + 1
    // Reuse common intent submission logic from swap_exact_input_for_output
    tracing::info!("Processing swap-input-for-exact-output intent");
    // MED-SW-1: 501, not 500. The exact-output swap variant is a
    // reserved endpoint pending integration of the inverse AMM math
    // (`amount_in = (Rin*Aout*1e4) / ((Rout-Aout)*(1e4-fee)) + 1`).
    Err(ApiError::NotImplemented(
        "swap-input-for-exact-output is not yet wired up; use \
         /intents/swap-exact-input-for-output instead"
            .to_string(),
    ))
}
