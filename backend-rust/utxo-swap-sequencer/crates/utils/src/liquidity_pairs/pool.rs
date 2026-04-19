use anyhow::Result;
use api_common::context::AppContext;
use entity_crate::pools;
use rust_decimal::prelude::*;
use sea_orm::*;

/// On-chain pool state fetched from CKB indexer
#[derive(Debug, Clone)]
pub struct OnChainPoolState {
    pub asset_x_reserve: u128,
    pub asset_y_reserve: u128,
    pub total_lp_supply: u128,
    pub fee_rate: u64,
    /// BL-C2: Actual type_script args for the LP token (from pool on-chain type_script)
    pub lp_type_args: Option<Vec<u8>>,
}

/// Fetch live pool reserves from CKB indexer
pub async fn fetch_pool_state(ctx: &AppContext, pool_type_hash: &[u8; 32]) -> Result<OnChainPoolState> {
    let client = reqwest::Client::new();
    let indexer_url = &ctx.config.ckb_indexer_url;

    let request_body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "get_cells",
        "params": [{
            "script": {
                "code_hash": format!("0x{}", hex::encode(pool_type_hash)),
                "hash_type": "type",
                "args": "0x"
            },
            "script_type": "type",
            "script_search_mode": "exact"
        }, "asc", "0x1"]
    });

    let resp = client.post(indexer_url)
        .json(&request_body)
        .send()
        .await?;

    let body: serde_json::Value = resp.json().await?;
    let cells = body["result"]["objects"].as_array()
        .ok_or_else(|| anyhow::anyhow!("No pool cell found"))?;

    if cells.is_empty() {
        anyhow::bail!("Pool cell not found for type_hash {}", hex::encode(pool_type_hash));
    }

    let cell = &cells[0];
    let data_hex = cell["output_data"].as_str().unwrap_or("0x");
    let data = hex::decode(data_hex.trim_start_matches("0x"))?;

    // Pool cell data layout (UTXOSwap):
    // reserve_x: u128 (16 bytes LE)
    // reserve_y: u128 (16 bytes LE)
    // total_lp: u128 (16 bytes LE)
    // fee_rate: u64 (8 bytes LE)
    if data.len() < 56 {
        anyhow::bail!("Pool cell data too short: {} bytes", data.len());
    }

    let reserve_x = u128::from_le_bytes(data[0..16].try_into()?);
    let reserve_y = u128::from_le_bytes(data[16..32].try_into()?);
    let total_lp = u128::from_le_bytes(data[32..48].try_into()?);
    let fee_rate = u64::from_le_bytes(data[48..56].try_into()?);

    // BL-C2: Extract LP type_script args from the pool cell's type_script
    let lp_type_args = cell["output"]["type"]
        .as_object()
        .and_then(|ts| ts.get("args"))
        .and_then(|a| a.as_str())
        .and_then(|args_hex| hex::decode(args_hex.trim_start_matches("0x")).ok());

    Ok(OnChainPoolState {
        asset_x_reserve: reserve_x,
        asset_y_reserve: reserve_y,
        total_lp_supply: total_lp,
        fee_rate,
        lp_type_args,
    })
}

/// Sync pool reserves from on-chain to DB
pub async fn sync_pool_reserves(ctx: &AppContext, pool: &pools::Model) -> Result<()> {
    let mut type_hash = [0u8; 32];
    type_hash.copy_from_slice(&pool.type_hash);

    match fetch_pool_state(ctx, &type_hash).await {
        Ok(state) => {
            let mut am: pools::ActiveModel = pool.clone().into();
            am.asset_x_amount = Set(Some(Decimal::from(state.asset_x_reserve)));
            am.asset_y_amount = Set(Some(Decimal::from(state.asset_y_reserve)));
            am.update(ctx.db()).await?;
            tracing::debug!("Pool {} reserves synced: x={}, y={}",
                hex::encode(&pool.type_hash), state.asset_x_reserve, state.asset_y_reserve);
        }
        Err(e) => {
            tracing::warn!("Failed to sync pool {}: {}", hex::encode(&pool.type_hash), e);
        }
    }
    Ok(())
}
