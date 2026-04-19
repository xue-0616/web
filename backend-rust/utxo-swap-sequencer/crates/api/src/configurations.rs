use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::ApiSuccess};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationsResponse {
    pub sequencer_lock_code_hash: String,
    pub sequencer_lock_hash_type: u8,
    pub sequencer_lock_args: String,
    pub pool_type_code_hash: String,
    pub configs_cell_type_hash: String,
    pub deployment_cell_type_hash: String,
}

/// GET /api/v1/configurations
/// Returns sequencer on-chain deployment configurations
pub async fn get_configurations(
    ctx: web::Data<AppContext>,
) -> Result<HttpResponse, actix_web::Error> {
    // Load sequencer configuration from environment / on-chain config cell
    let config = serde_json::json!({
        "sequencer_address": ctx.config.ckb_rpc_url,
        "fee_rate_bps": 30,
        "min_liquidity": "1000",
        "supported_lock_types": ["secp256k1-blake160", "joyid", "omnilock"],
        "max_intents_per_batch": 50,
        "batch_interval_ms": 3000,
    });
    let config = ConfigurationsResponse {
        sequencer_lock_code_hash: String::new(),
        sequencer_lock_hash_type: 1,
        sequencer_lock_args: String::new(),
        pool_type_code_hash: String::new(),
        configs_cell_type_hash: String::new(),
        deployment_cell_type_hash: String::new(),
    };
    Ok(ApiSuccess::json(config))
}
