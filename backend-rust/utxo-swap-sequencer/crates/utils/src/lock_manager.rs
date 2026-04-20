use anyhow::Result;
// NOTE: `redis::AsyncCommands` is intentionally not imported — all
// lock ops run through `redis::cmd(...)` + Lua so the TOCTOU
// guarantees from H-4 / L-5 stay auditable in one place.

/// Redis-based distributed lock manager for pool processing
///
/// SECURITY (H-4, L-5): Uses unique lock values for ownership verification
/// and Lua script for atomic release to prevent TOCTOU race conditions.
pub struct LockManager {
    prefix: String,
}

impl LockManager {
    pub fn new(prefix: &str) -> Self {
        Self { prefix: prefix.to_string() }
    }

    fn lock_key(&self, key: &str) -> String {
        format!("{}:{}", self.prefix, key)
    }

    /// Generate a unique lock value for ownership verification
    fn generate_lock_value() -> String {
        format!("{}:{}", std::process::id(), chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0))
    }

    /// Acquire a lock with ownership tracking
    /// Returns the lock value (needed for release) or None if lock not acquired
    pub async fn acquire(&self, redis: &deadpool_redis::Pool, key: &str, ttl_ms: u64) -> Result<Option<String>> {
        let mut conn = redis.get().await?;
        let lock_key = self.lock_key(key);
        let lock_value = Self::generate_lock_value();

        // SET key value NX PX ttl_ms
        let result: Option<String> = redis::cmd("SET")
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

    /// SECURITY (H-4): Release lock with ownership verification using Lua script
    /// Only deletes the key if the current value matches our lock_value
    pub async fn release(&self, redis: &deadpool_redis::Pool, key: &str, lock_value: &str) -> Result<bool> {
        let mut conn = redis.get().await?;
        let lock_key = self.lock_key(key);

        // Atomic check-and-delete
        let lua_script = r#"
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        "#;

        let result: i32 = redis::cmd("EVAL")
            .arg(lua_script)
            .arg(1)
            .arg(&lock_key)
            .arg(lock_value)
            .query_async(&mut *conn)
            .await?;

        Ok(result == 1)
    }

    /// Extend lock TTL with ownership verification
    pub async fn extend(&self, redis: &deadpool_redis::Pool, key: &str, lock_value: &str, ttl_ms: u64) -> Result<bool> {
        let mut conn = redis.get().await?;
        let lock_key = self.lock_key(key);

        // Atomic check-and-extend
        let lua_script = r#"
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("pexpire", KEYS[1], ARGV[2])
            else
                return 0
            end
        "#;

        let result: i32 = redis::cmd("EVAL")
            .arg(lua_script)
            .arg(1)
            .arg(&lock_key)
            .arg(lock_value)
            .arg(ttl_ms.to_string())
            .query_async(&mut *conn)
            .await?;

        Ok(result == 1)
    }
}
