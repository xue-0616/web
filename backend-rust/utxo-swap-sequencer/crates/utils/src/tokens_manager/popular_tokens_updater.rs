use api_common::context::AppContext;
use entity_crate::pools;
use rust_decimal::prelude::*;
use sea_orm::*;
use std::collections::HashMap;

/// Update popular (top) tokens ranking by 24h volume and cache in Redis
pub async fn update_popular_tokens(ctx: &AppContext) -> anyhow::Result<()> {
    let all_pools = pools::Entity::find().all(ctx.db()).await?;

    // Aggregate volume per token type_hash
    let mut volume_map: HashMap<Vec<u8>, Decimal> = HashMap::new();

    for pool in &all_pools {
        let day_vol = pool.day_volume.unwrap_or(Decimal::ZERO);
        if day_vol.is_zero() { continue; }

        // Split volume equally between both assets
        let half = day_vol / Decimal::from(2);
        *volume_map.entry(pool.asset_x_type_hash.clone()).or_insert(Decimal::ZERO) += half;
        *volume_map.entry(pool.asset_y_type_hash.clone()).or_insert(Decimal::ZERO) += half;
    }

    // Sort by volume descending
    let mut ranked: Vec<(Vec<u8>, Decimal)> = volume_map.into_iter().collect();
    ranked.sort_by(|a, b| b.1.cmp(&a.1));

    // Take top 20 and cache in Redis
    let top: Vec<String> = ranked.iter()
        .take(20)
        .map(|(hash, vol)| format!("{}:{}", hex::encode(hash), vol))
        .collect();

    let mut conn = ctx.redis_conn().await?;
    let json = serde_json::to_string(&top)?;
    redis::cmd("SET")
        .arg("sequencer:popular_tokens")
        .arg(&json)
        .arg("EX")
        .arg(300) // 5 min TTL
        .query_async::<()>(&mut conn)
        .await?;

    tracing::info!("Popular tokens updated: {} tokens ranked", ranked.len());
    Ok(())
}
