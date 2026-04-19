use anyhow::Result;
use deadpool_redis::{Config, Runtime, Pool};

/// Create Redis connection pool
pub fn create_pool(redis_url: &str) -> Result<Pool> {
    let cfg = Config::from_url(redis_url);
    let pool = cfg.create_pool(Some(Runtime::Tokio1))?;
    Ok(pool)
}
