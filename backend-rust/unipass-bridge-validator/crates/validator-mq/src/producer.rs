use crate::types::{ValidationMessage, VALIDATED_STREAM, DLQ_STREAM};
use anyhow::Result;

/// Redis stream producer — publish validated payments for batching.
/// Includes message deduplication check before enqueue.
pub async fn publish_validated_payment(
    redis_pool: &deadpool_redis::Pool,
    message: &ValidationMessage,
) -> Result<String> {
    let mut conn = redis_pool.get().await?;

    // Deduplication: check if this payment_id is already in the stream
    let dedup_key = format!(
        "mq:dedup:{}:{}:{}",
        message.source_chain_id,
        message.tx_hash.to_lowercase(),
        message.log_index
    );
    let already_exists: bool = redis::cmd("EXISTS")
        .arg(&dedup_key)
        .query_async(&mut *conn)
        .await?;

    if already_exists {
        tracing::warn!(
            "Duplicate message rejected for tx={} log_index={}",
            message.tx_hash,
            message.log_index
        );
        return Ok("duplicate".to_string());
    }

    // Publish to stream
    let data = serde_json::to_string(message)?;
    let msg_id: String = redis::cmd("XADD")
        .arg(VALIDATED_STREAM)
        .arg("*")
        .arg("payment_id")
        .arg(message.payment_id)
        .arg("data")
        .arg(&data)
        .query_async(&mut *conn)
        .await?;

    // Set dedup key with TTL (24 hours)
    redis::cmd("SET")
        .arg(&dedup_key)
        .arg(&msg_id)
        .arg("EX")
        .arg(24 * 3600)
        .query_async::<_, ()>(&mut *conn)
        .await?;

    tracing::info!(
        "Published validated payment to MQ: payment_id={}, msg_id={}",
        message.payment_id,
        msg_id
    );
    Ok(msg_id)
}

/// Move a failed message to the dead letter queue after max retries.
pub async fn move_to_dlq(
    redis_pool: &deadpool_redis::Pool,
    message: &ValidationMessage,
    error: &str,
) -> Result<()> {
    let mut conn = redis_pool.get().await?;
    let data = serde_json::to_string(message)?;
    redis::cmd("XADD")
        .arg(DLQ_STREAM)
        .arg("*")
        .arg("data")
        .arg(&data)
        .arg("error")
        .arg(error)
        .query_async::<_, String>(&mut *conn)
        .await?;
    tracing::error!(
        "Message moved to DLQ: payment_id={}, error={}",
        message.payment_id,
        error
    );
    Ok(())
}
