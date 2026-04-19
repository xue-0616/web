use actix_web::{web, HttpResponse};
use api::context::RelayerContext;
use ethers::providers::Middleware;
use ethers::types::{Address, BlockNumber};
use serde::Deserialize;
use std::str::FromStr;

use super::rpc_client::provider_for_chain;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NonceQuery {
    pub address: String,
    pub chain_id: u64,
}

/// GET /api/v1/nonce?address=0x...&chainId=42161
pub async fn handler(
    ctx: web::Data<RelayerContext>,
    query: web::Query<NonceQuery>,
) -> HttpResponse {
    let address = match Address::from_str(&query.address) {
        Ok(a) => a,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "invalid address"}));
        }
    };
    let provider = match provider_for_chain(&ctx.config, query.chain_id) {
        Ok(p) => p,
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": e.to_string()}));
        }
    };
    match provider
        .get_transaction_count(address, Some(BlockNumber::Latest.into()))
        .await
    {
        Ok(nonce) => HttpResponse::Ok().json(serde_json::json!({"nonce": nonce.as_u64()})),
        Err(e) => {
            tracing::warn!(?e, chain_id = query.chain_id, "eth_getTransactionCount failed");
            HttpResponse::BadGateway()
                .json(serde_json::json!({"error": format!("rpc error: {}", e)}))
        }
    }
}
