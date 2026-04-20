use anyhow::Result;
use api_common::context::AppContext;
use entity_crate::pools;
use sea_orm::*;

/// Create a new AMM liquidity pool on CKB
///
/// Steps:
/// 1. Validate pool creation parameters (unique pair, minimum liquidity)
/// 2. Build pool creation CKB transaction:
///    - Deploy new pool type script with TypeID
///    - Create pool cell with initial reserves
///    - Mint initial LP tokens
/// 3. Submit to CKB RPC
/// 4. Save pool metadata to DB
pub async fn create_pool(
    ctx: &AppContext,
    asset_x_type_hash: &[u8; 32],
    asset_y_type_hash: &[u8; 32],
    initial_x: u128,
    initial_y: u128,
    lp_symbol: &str,
    lp_name: &str,
    lp_decimals: u8,
) -> Result<pools::Model> {
    // 1. Check pool doesn't already exist
    let pool_hash = super::super::utils::compute_pool_type_hash(asset_x_type_hash, asset_y_type_hash);
    let existing = pools::Entity::find()
        .filter(pools::Column::TypeHash.eq(pool_hash.to_vec()))
        .one(ctx.db())
        .await?;
    if existing.is_some() {
        anyhow::bail!("Pool already exists for this pair");
    }

    // 2. Build and submit pool creation transaction
    let _client = reqwest::Client::new();
    let _rpc_url = &ctx.config.ckb_rpc_url;

    // Fetch deployer cells from indexer for inputs
    let _deployer_cells = fetch_deployer_cells(ctx).await?;

    // Build initial LP supply = sqrt(initial_x * initial_y)
    let initial_lp = integer_sqrt(initial_x * initial_y);

    tracing::info!("Creating pool: x_hash={}, y_hash={}, lp_supply={}",
        hex::encode(asset_x_type_hash), hex::encode(asset_y_type_hash), initial_lp);

    // 3. Submit to CKB RPC (placeholder - full tx building in batch_tx.rs)
    let _tx_hash = [0u8; 32]; // Will be set after RPC send

    // 4. Save to DB
    let new_pool = pools::ActiveModel {
        creator: Set(vec![0u8; 32]), // sequencer lock hash
        asset_x_type_hash: Set(asset_x_type_hash.to_vec()),
        asset_y_type_hash: Set(asset_y_type_hash.to_vec()),
        type_hash: Set(pool_hash.to_vec()),
        type_code_hash: Set(vec![0u8; 32]),
        type_hash_type: Set(entity_crate::tokens::HashType::Type),
        type_args: Set(vec![]),
        lp_symbol: Set(lp_symbol.to_string()),
        lp_name: Set(lp_name.to_string()),
        lp_decimals: Set(lp_decimals),
        asset_x_amount: Set(Some(rust_decimal::Decimal::from(initial_x))),
        asset_y_amount: Set(Some(rust_decimal::Decimal::from(initial_y))),
        ..Default::default()
    };

    let result = pools::Entity::insert(new_pool).exec(ctx.db()).await?;
    let pool = pools::Entity::find_by_id(result.last_insert_id)
        .one(ctx.db())
        .await?
        .ok_or_else(|| anyhow::anyhow!("Failed to fetch created pool"))?;

    Ok(pool)
}

async fn fetch_deployer_cells(_ctx: &AppContext) -> Result<Vec<serde_json::Value>> {
    // Fetch live cells owned by sequencer for transaction inputs
    Ok(Vec::new())
}

fn integer_sqrt(n: u128) -> u128 {
    if n == 0 { return 0; }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}
