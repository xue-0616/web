//! Redis helper — pool + a couple of typed get/set for the session
//! nonce-challenge pattern.

use deadpool_redis::{Config as DeadpoolConfig, Pool, Runtime};
use redis::AsyncCommands;

use crate::error::Error;

pub type RedisPool = Pool;

pub fn build_pool(url: &str) -> Result<RedisPool, Error> {
    let cfg = DeadpoolConfig::from_url(url);
    cfg.create_pool(Some(Runtime::Tokio1))
        .map_err(|e| Error::Internal(format!("redis pool: {e}")))
}

/// Key convention for login challenges: `REDIS_DB_SNAP_login_challenge:<wallet_lower>`.
/// Matches the closed-source string `REDIS_DB_SNAP_` recovered from rodata.
pub fn login_challenge_key(wallet_lower: &str) -> String {
    format!("REDIS_DB_SNAP_login_challenge:{wallet_lower}")
}

pub async fn put_challenge(
    pool: &RedisPool,
    wallet_lower: &str,
    nonce: &str,
    ttl_secs: u64,
) -> Result<(), Error> {
    let mut conn = pool.get().await.map_err(|e| Error::Internal(e.to_string()))?;
    let key = login_challenge_key(wallet_lower);
    let _: () = conn.set_ex(key, nonce, ttl_secs).await?;
    Ok(())
}

pub async fn take_challenge(
    pool: &RedisPool,
    wallet_lower: &str,
) -> Result<Option<String>, Error> {
    let mut conn = pool.get().await.map_err(|e| Error::Internal(e.to_string()))?;
    let key = login_challenge_key(wallet_lower);
    // GETDEL — atomic read-then-delete to enforce one-shot challenges.
    let v: Option<String> = conn.get_del(key).await?;
    Ok(v)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_key_is_stable_and_prefixed() {
        assert_eq!(
            login_challenge_key("0xabc"),
            "REDIS_DB_SNAP_login_challenge:0xabc"
        );
    }
}
