use std::time::Duration;

/// SECURITY (H-4): UUID for lock ownership verification
/// Each lock has a unique value. Only the holder can release it.
/// Uses Lua script for atomic check-and-delete (Redlock pattern).

/// Distributed lock for pool operations — prevents concurrent batch processing
/// Uses Redis SET NX with expiry and UUID for ownership (H-4)
pub async fn acquire_pool_lock(
    redis: &deadpool_redis::Pool,
    pool_hash: &[u8],
) -> anyhow::Result<PoolLock> {
    let key = format!("sequencer:pool_lock:{}", hex::encode(pool_hash));
    // Generate a unique lock value to verify ownership on release (H-4)
    let lock_value = format!("{}:{}", std::process::id(), chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let mut conn = redis.get().await?;

    // Try to acquire lock with 30s TTL using unique value
    let acquired: bool = redis::cmd("SET")
        .arg(&key)
        .arg(&lock_value)
        .arg("NX")
        .arg("EX")
        .arg(30)
        .query_async(&mut conn)
        .await
        .unwrap_or(false);

    if !acquired {
        anyhow::bail!("Failed to acquire pool lock for {}", hex::encode(pool_hash));
    }

    tracing::debug!("Acquired pool lock: {} (value={})", key, lock_value);

    Ok(PoolLock {
        key,
        lock_value,
        pool: redis.clone(),
    })
}

pub struct PoolLock {
    key: String,
    lock_value: String,
    pool: deadpool_redis::Pool,
}

impl PoolLock {
    /// Explicitly release the lock with ownership verification (H-4)
    /// Uses Lua script: only delete if current value matches our lock_value
    pub async fn release(self) -> anyhow::Result<()> {
        let mut conn = self.pool.get().await?;

        // SECURITY (H-4): Atomic check-and-delete via Lua script
        // Only the lock holder can release the lock
        let lua_script = r#"
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        "#;

        let result: i32 = redis::cmd("EVAL")
            .arg(lua_script)
            .arg(1) // number of KEYS
            .arg(&self.key)
            .arg(&self.lock_value)
            .query_async(&mut conn)
            .await
            .unwrap_or(0);

        if result == 1 {
            tracing::debug!("Released pool lock: {}", self.key);
        } else {
            tracing::warn!(
                "Lock release failed (ownership mismatch or expired): {}",
                self.key
            );
        }

        Ok(())
    }
}

impl Drop for PoolLock {
    fn drop(&mut self) {
        // SECURITY (H-4): Use ownership-verified release in Drop as fallback
        // This is fire-and-forget but at least verifies ownership
        let key = self.key.clone();
        let lock_value = self.lock_value.clone();
        let pool = self.pool.clone();
        tokio::spawn(async move {
            if let Ok(mut conn) = pool.get().await {
                // Atomic check-and-delete to prevent releasing someone else's lock
                let lua_script = r#"
                    if redis.call("get", KEYS[1]) == ARGV[1] then
                        return redis.call("del", KEYS[1])
                    else
                        return 0
                    end
                "#;
                let _: Result<i32, _> = redis::cmd("EVAL")
                    .arg(lua_script)
                    .arg(1)
                    .arg(&key)
                    .arg(&lock_value)
                    .query_async(&mut conn)
                    .await;
            }
        });
    }
}
