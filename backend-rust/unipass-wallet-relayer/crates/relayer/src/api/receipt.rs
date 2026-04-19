use actix_web::{web, HttpResponse};
use api::context::RelayerContext;
use ethers::providers::Middleware;
use ethers::types::H256;
use serde::Deserialize;
use std::str::FromStr;

use super::rpc_client::provider_for_chain;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptQuery {
    pub tx_hash: String,
    pub chain_id: u64,
}

/// GET /api/v1/receipt?txHash=0x...&chainId=42161
pub async fn handler(
    ctx: web::Data<RelayerContext>,
    query: web::Query<ReceiptQuery>,
) -> HttpResponse {
    let tx_hash = match H256::from_str(query.tx_hash.trim_start_matches("0x")) {
        Ok(h) => h,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "invalid tx hash"}));
        }
    };
    let provider = match provider_for_chain(&ctx.config, query.chain_id) {
        Ok(p) => p,
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": e.to_string()}));
        }
    };
    match provider.get_transaction_receipt(tx_hash).await {
        Ok(Some(receipt)) => HttpResponse::Ok().json(serde_json::json!({"receipt": receipt})),
        Ok(None) => HttpResponse::Ok().json(serde_json::json!({"receipt": null})),
        Err(e) => {
            tracing::warn!(?e, chain_id = query.chain_id, "eth_getTransactionReceipt failed");
            HttpResponse::BadGateway()
                .json(serde_json::json!({"error": format!("rpc error: {}", e)}))
        }
    }
}
