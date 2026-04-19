use api_common::context::AppContext;
use entity_crate::pools;
use entity_crate::tokens;
use rust_decimal::prelude::*;
use sea_orm::*;
use std::collections::HashMap;

/// CKB native token type_hash (all zeros = CKB)
const CKB_TYPE_HASH: [u8; 32] = [0u8; 32];

/// Update token prices from pool data and external sources (CMC API)
pub async fn update_prices(ctx: &AppContext) -> anyhow::Result<()> {
    // 1. Fetch CKB/USD price from CoinMarketCap, fall back to Redis cache (not a hardcoded value)
    let ckb_price = match fetch_ckb_price().await {
        Ok(price) => price,
        Err(e) => {
            tracing::warn!("Failed to fetch CKB price from CMC: {}. Trying Redis cache.", e);
            // Try to use last known good price from Redis cache
            let cached = get_cached_ckb_price(ctx).await;
            match cached {
                Some(price) => {
                    tracing::info!("Using cached CKB price: {:.6}", price);
                    price
                }
                None => {
                    tracing::error!("No cached CKB price available, skipping price update");
                    anyhow::bail!("Cannot update prices: no CMC data and no cached price");
                }
            }
        }
    };
    let ckb_price_dec = Decimal::from_f64(ckb_price).unwrap_or(Decimal::ZERO);

    // 2. Build token price map: type_hash -> price_usd
    let mut price_map: HashMap<Vec<u8>, Decimal> = HashMap::new();
    price_map.insert(CKB_TYPE_HASH.to_vec(), ckb_price_dec);

    // 3. Calculate other token prices from pool reserves
    let all_pools = pools::Entity::find().all(ctx.db()).await?;

    // Build token decimals map
    let all_tokens = tokens::Entity::find().all(ctx.db()).await?;
    let decimals_map: HashMap<Vec<u8>, u8> = all_tokens
        .iter()
        .map(|t| (t.type_hash.clone(), t.decimals))
        .collect();

    // Multi-pass price derivation: derive prices from pools where one side is known
    for _pass in 0..3 {
        for pool in &all_pools {
            if let (Some(x_amount), Some(y_amount)) = (&pool.asset_x_amount, &pool.asset_y_amount) {
                if x_amount.is_zero() || y_amount.is_zero() {
                    continue;
                }
                let x_hash = &pool.asset_x_type_hash;
                let y_hash = &pool.asset_y_type_hash;
                let x_dec = decimals_map.get(x_hash).copied().unwrap_or(8);
                let y_dec = decimals_map.get(y_hash).copied().unwrap_or(8);

                let x_known = price_map.get(x_hash).copied();
                let y_known = price_map.get(y_hash).copied();

                match (x_known, y_known) {
                    (Some(px), None) => {
                        // price_y = price_x * (reserve_x / 10^x_dec) / (reserve_y / 10^y_dec)
                        let x_norm = x_amount / Decimal::from(10u64.pow(x_dec as u32));
                        let y_norm = y_amount / Decimal::from(10u64.pow(y_dec as u32));
                        if !y_norm.is_zero() {
                            let py = px * x_norm / y_norm;
                            price_map.insert(y_hash.clone(), py);
                        }
                    }
                    (None, Some(py)) => {
                        let x_norm = x_amount / Decimal::from(10u64.pow(x_dec as u32));
                        let y_norm = y_amount / Decimal::from(10u64.pow(y_dec as u32));
                        if !x_norm.is_zero() {
                            let px = py * y_norm / x_norm;
                            price_map.insert(x_hash.clone(), px);
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    // 4. Update pool TVL and based_asset_price in DB
    for pool in &all_pools {
        if let (Some(x_amount), Some(y_amount)) = (&pool.asset_x_amount, &pool.asset_y_amount) {
            let x_dec = decimals_map.get(&pool.asset_x_type_hash).copied().unwrap_or(8);
            let y_dec = decimals_map.get(&pool.asset_y_type_hash).copied().unwrap_or(8);
            let x_norm = x_amount / Decimal::from(10u64.pow(x_dec as u32));
            let y_norm = y_amount / Decimal::from(10u64.pow(y_dec as u32));

            let px = price_map.get(&pool.asset_x_type_hash).copied().unwrap_or(Decimal::ZERO);
            let py = price_map.get(&pool.asset_y_type_hash).copied().unwrap_or(Decimal::ZERO);

            let tvl = x_norm * px + y_norm * py;

            // Determine based_asset price for the pool
            let based_price = if px > Decimal::ZERO { px } else { py };

            let mut am: pools::ActiveModel = pool.clone().into();
            am.tvl = Set(Some(tvl));
            am.based_asset_price = Set(Some(based_price));
            am.update(ctx.db()).await?;
        }
    }

    // 5. Cache prices in Redis
    let mut conn = ctx.redis_conn().await?;
    redis::cmd("SET")
        .arg("sequencer:price:ckb")
        .arg(ckb_price.to_string())
        .arg("EX")
        .arg(120) // 2 minute TTL
        .query_async::<()>(&mut conn)
        .await?;

    // Cache all token prices
    for (type_hash, price) in &price_map {
        let key = format!("sequencer:price:{}", hex::encode(type_hash));
        redis::cmd("SET")
            .arg(&key)
            .arg(price.to_string())
            .arg("EX")
            .arg(120)
            .query_async::<()>(&mut conn)
            .await?;
    }

    tracing::info!("Price oracle updated: {} tokens, CKB=${:.6}", price_map.len(), ckb_price);
    Ok(())
}

/// Fetch CKB/USD price from CoinMarketCap API
/// SECURITY: API key must be set via CMC_API_KEY environment variable.
/// Never hardcode API keys in source code. If a key was previously committed, rotate it immediately.
async fn fetch_ckb_price() -> anyhow::Result<f64> {
    let api_key = std::env::var("CMC_API_KEY")
        .map_err(|_| anyhow::anyhow!("CMC_API_KEY environment variable is not set — cannot fetch price"))?;

    if api_key.is_empty() {
        anyhow::bail!("CMC_API_KEY is empty — cannot fetch price");
    }

    let client = reqwest::Client::new();
    let resp = client
        .get("https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest")
        .query(&[("slug", "nervos-network")])
        .header("X-CMC_PRO_API_KEY", &api_key)
        .header("Accept", "application/json")
        .send()
        .await?;

    if !resp.status().is_success() {
        tracing::warn!("CMC API returned status {}, price update skipped", resp.status());
        anyhow::bail!("CMC API returned non-success status: {}", resp.status());
    }

    let body: serde_json::Value = resp.json().await?;
    // Navigate: data -> <id> -> quote -> USD -> price
    if let Some(data) = body.get("data") {
        if let Some(obj) = data.as_object() {
            for (_id, coin) in obj {
                if let Some(price) = coin
                    .get("quote")
                    .and_then(|q| q.get("USD"))
                    .and_then(|u| u.get("price"))
                    .and_then(|p| p.as_f64())
                {
                    if price <= 0.0 {
                        anyhow::bail!("CMC returned non-positive price: {}", price);
                    }
                    return Ok(price);
                }
            }
        }
    }

    tracing::warn!("CMC API response missing price field, price update skipped");
    anyhow::bail!("CMC API response missing price data")
}

/// Retrieve the last cached CKB price from Redis (set by previous successful update_prices call)
async fn get_cached_ckb_price(ctx: &AppContext) -> Option<f64> {
    let mut conn = ctx.redis_conn().await.ok()?;
    let cached: Option<String> = redis::cmd("GET")
        .arg("sequencer:price:ckb")
        .query_async(&mut conn)
        .await
        .ok()?;
    cached.and_then(|s| s.parse::<f64>().ok()).filter(|p| *p > 0.0)
}
