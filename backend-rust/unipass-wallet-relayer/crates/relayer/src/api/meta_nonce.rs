use actix_web::{web, HttpResponse};
use api::context::RelayerContext;
use contracts_abi::module_main::ModuleMain;
use ethers::types::Address;
use serde::Deserialize;
use std::str::FromStr;

use super::rpc_client::provider_for_chain;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaNonceQuery {
    pub address: String,
    pub chain_id: u64,
}

/// GET /api/v1/meta-nonce?address=0x...&chainId=42161
///
/// Calls `ModuleMain.metaNonce()` on the wallet contract via `eth_call`.
pub async fn handler(
    ctx: web::Data<RelayerContext>,
    query: web::Query<MetaNonceQuery>,
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
    let contract = ModuleMain::new(address, provider);
    match contract.meta_nonce().call().await {
        Ok(meta_nonce) => {
            HttpResponse::Ok().json(serde_json::json!({"metaNonce": meta_nonce.to_string()}))
        }
        Err(e) => {
            // Wallet may not be deployed yet — surface as metaNonce=0 per convention.
            tracing::debug!(?e, wallet = %query.address, "metaNonce call failed, defaulting to 0");
            HttpResponse::Ok().json(serde_json::json!({"metaNonce": "0"}))
        }
    }
}
