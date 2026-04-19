use anyhow::Result;

pub struct LockManager {
    pub prefix: String,
}

impl LockManager {
    pub fn new(prefix: &str) -> Self { Self { prefix: prefix.to_string() } }

    pub async fn acquire(&self, redis: &deadpool_redis::Pool, key: &str, ttl_ms: u64) -> Result<bool> {
        let mut conn = redis.get().await?;
        let lock_key = format!("{}:{}", self.prefix, key);
        let result: Option<String> = deadpool_redis::redis::cmd("SET")
            .arg(&lock_key).arg("1").arg("NX").arg("PX").arg(ttl_ms)
            .query_async(&mut *conn).await?;
        Ok(result.is_some())
    }

    pub async fn release(&self, redis: &deadpool_redis::Pool, key: &str) -> Result<()> {
        let mut conn = redis.get().await?;
        let lock_key = format!("{}:{}", self.prefix, key);
        let _: () = deadpool_redis::redis::cmd("DEL")
            .arg(&lock_key)
            .query_async(&mut *conn).await?;
        Ok(())
    }
}
