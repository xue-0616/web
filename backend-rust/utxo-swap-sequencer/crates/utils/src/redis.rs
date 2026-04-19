/// Redis utility functions for the sequencer
use deadpool_redis::Pool;

pub const INTENT_CHANNEL: &str = "sequencer:new_intent";
pub const PRICE_PREFIX: &str = "sequencer:price:";
pub const POOL_LOCK_PREFIX: &str = "sequencer:pool_lock:";
pub const POPULAR_TOKENS_KEY: &str = "sequencer:popular_tokens";
pub const TOP_TOKENS_KEY: &str = "sequencer:top_tokens";

pub async fn get_cached_price(pool: &Pool, token_hash: &str) -> anyhow::Result<Option<f64>> {
    let mut conn = pool.get().await?;
    let key = format!("{}{}", PRICE_PREFIX, token_hash);
    let result: Option<String> = redis::cmd("GET")
        .arg(&key)
        .query_async(&mut conn)
        .await?;
    Ok(result.and_then(|s| s.parse().ok()))
}

pub async fn set_cached_price(
    pool: &Pool,
    token_hash: &str,
    price: f64,
    ttl_secs: u64,
) -> anyhow::Result<()> {
    let mut conn = pool.get().await?;
    let key = format!("{}{}", PRICE_PREFIX, token_hash);
    redis::cmd("SET")
        .arg(&key)
        .arg(price.to_string())
        .arg("EX")
        .arg(ttl_secs)
        .query_async::<()>(&mut conn)
        .await?;
    Ok(())
}
