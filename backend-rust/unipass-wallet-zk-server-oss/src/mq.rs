//! Redis task stream wrapper.
//!
//! The closed-source ELF uses `XADD` to enqueue and `XREADGROUP` to
//! consume. We re-create the same shape so pre-existing tasks on
//! long-running deployments (Redis data directory) stay compatible.

use deadpool_redis::{Config as DeadpoolConfig, Pool, Runtime};
use redis::AsyncCommands;

use crate::{error::Error, types::ProveTask};

pub type RedisPool = Pool;

pub fn build_pool(url: &str) -> Result<RedisPool, Error> {
    DeadpoolConfig::from_url(url)
        .create_pool(Some(Runtime::Tokio1))
        .map_err(|e| Error::Internal(format!("redis pool: {e}")))
}

/// Enqueue a `ProveTask`. Returns the Redis stream id.
///
/// Payload field is named `payload` to match the ELF's rodata
/// string — changing this breaks bilateral replays against
/// data produced by the closed-source binary.
pub async fn enqueue(pool: &RedisPool, stream: &str, task: &ProveTask) -> Result<String, Error> {
    let mut conn = pool.get().await.map_err(|e| Error::Internal(e.to_string()))?;
    let body = serde_json::to_string(task)?;
    let id: String = conn.xadd(stream, "*", &[("payload", body)]).await?;
    Ok(id)
}

/// Ensure the consumer group exists. Ignores `BUSYGROUP` (already exists).
pub async fn ensure_group(pool: &RedisPool, stream: &str, group: &str) -> Result<(), Error> {
    let mut conn = pool.get().await.map_err(|e| Error::Internal(e.to_string()))?;
    let result: redis::RedisResult<String> =
        conn.xgroup_create_mkstream(stream, group, "0").await;
    match result {
        Ok(_) => Ok(()),
        Err(e) if e.to_string().contains("BUSYGROUP") => Ok(()),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::EmailType;

    #[test]
    fn task_serialises_into_payload_field_shape() {
        // Make sure the JSON we enqueue is a plain ProveTask object with
        // stable keys the consumer can deserialise back.
        let t = ProveTask {
            header_hash: "0xdead".into(),
            email: "hello".into(),
            email_type: EmailType::OpenId,
        };
        let json = serde_json::to_string(&t).unwrap();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v["header_hash"], "0xdead");
        assert_eq!(v["email"], "hello");
        assert_eq!(v["email_type"], "open_id");
    }
}
