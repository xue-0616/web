use actix_web::{web, HttpResponse};
use api::context::RelayerContext;
use ethers::providers::Middleware;
use ethers::types::{Address, Bytes, TransactionRequest};
use serde::Deserialize;
use std::str::FromStr;

use super::rpc_client::provider_for_chain;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulateRequest {
    pub chain_id: u64,
    pub wallet_address: String,
    pub calldata: String,
}

/// POST /api/v1/simulate
///
/// Performs `eth_estimateGas` against the wallet contract. If the call reverts
/// we return `{ success: false, reason }` so clients can surface the simulated
/// failure without submitting the transaction.
pub async fn handler(
    ctx: web::Data<RelayerContext>,
    body: web::Json<SimulateRequest>,
) -> HttpResponse {
    let to = match Address::from_str(&body.wallet_address) {
        Ok(a) => a,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "invalid wallet address"}));
        }
    };
    let data = match Bytes::from_str(body.calldata.trim_start_matches("0x")) {
        Ok(b) => b,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "invalid calldata hex"}));
        }
    };
    let provider = match provider_for_chain(&ctx.config, body.chain_id) {
        Ok(p) => p,
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": e.to_string()}));
        }
    };

    let tx = TransactionRequest::new().to(to).data(data);
    match provider.estimate_gas(&tx.into(), None).await {
        Ok(gas) => HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "gasEstimate": gas.as_u64(),
        })),
        Err(e) => {
            tracing::debug!(?e, chain_id = body.chain_id, "simulate estimateGas reverted");
            HttpResponse::Ok().json(serde_json::json!({
                "success": false,
                "reason": e.to_string(),
            }))
        }
    }
}
