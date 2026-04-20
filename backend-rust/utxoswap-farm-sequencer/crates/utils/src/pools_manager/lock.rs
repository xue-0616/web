use anyhow::Result;

/// BUG-28 FIX: Lock manager now uses a unique lock value (UUID) and a Lua
/// script for atomic release (delete-only-if-value-matches). This prevents
/// a process from accidentally releasing another process's lock when the
/// original lock TTL has expired.
pub struct FarmLockManager {
    pub prefix: String,
}

impl FarmLockManager {
    pub fn new(prefix: &str) -> Self { Self { prefix: prefix.to_string() } }

    /// Acquire a distributed lock. Returns `Some(lock_value)` on success,
    /// `None` if the lock is already held. The returned value must be passed
    /// to `release()` to ensure only the holder can release the lock.
    pub async fn acquire(&self, redis: &deadpool_redis::Pool, key: &str, ttl_ms: u64) -> Result<Option<String>> {
        let mut conn = redis.get().await?;
        let lock_key = format!("{}:{}", self.prefix, key);
        // Use a unique value so only the lock holder can release it
        let lock_value = uuid::Uuid::new_v4().to_string();
        let result: Option<String> = deadpool_redis::redis::cmd("SET")
            .arg(&lock_key)
            .arg(&lock_value)
            .arg("NX")
            .arg("PX")
            .arg(ttl_ms)
            .query_async(&mut *conn)
            .await?;
        if result.is_some() {
            Ok(Some(lock_value))
        } else {
            Ok(None)
        }
    }

    /// Release the lock only if the current holder's value matches.
    /// Uses an atomic Lua script to prevent deleting another holder's lock.
    pub async fn release(&self, redis: &deadpool_redis::Pool, key: &str, lock_value: &str) -> Result<bool> {
        let mut conn = redis.get().await?;
        let lock_key = format!("{}:{}", self.prefix, key);
        // Lua script: delete key only if value matches (atomic compare-and-delete)
        let lua_script = r#"
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
        "#;
        let result: i64 = deadpool_redis::redis::cmd("EVAL")
            .arg(lua_script)
            .arg(1)  // number of keys
            .arg(&lock_key)
            .arg(lock_value)
            .query_async(&mut *conn)
            .await?;
        Ok(result == 1)
    }
}
