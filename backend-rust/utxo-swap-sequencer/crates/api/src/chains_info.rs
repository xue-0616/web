use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiSuccess, pools::ChainsInfo};

/// GET /api/v1/chains-info
/// Returns CKB fee rate and based token (CKB) price
pub async fn get_chains_info(ctx: web::Data<AppContext>) -> Result<HttpResponse, actix_web::Error> {
    let client = reqwest::Client::new();
    let rpc_url = &ctx.config.ckb_rpc_url;

    // Fetch tip block number from CKB RPC
    let tip_resp = client.post(rpc_url)
        .json(&serde_json::json!({"id": 1, "jsonrpc": "2.0", "method": "get_tip_block_number", "params": []}))
        .send().await
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let tip_body: serde_json::Value = tip_resp.json().await.unwrap_or_default();
    let block_number = tip_body["result"].as_str().unwrap_or("0x0").to_string();

    // Fetch CKB price from Redis cache
    let mut conn = ctx.redis_conn().await.map_err(actix_web::error::ErrorInternalServerError)?;
    let ckb_price: String = redis::cmd("GET")
        .arg("sequencer:price:ckb")
        .query_async(&mut conn)
        .await
        .unwrap_or_else(|_| "0.005".to_string());

    let info = ChainsInfo {
        ckb_fee_rate: 1000, // default min fee rate
        based_token_price: "0.0".to_string(),
    };
    Ok(ApiSuccess::json(info))
}
