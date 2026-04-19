use crate::types::{ValidationMessage, VALIDATED_STREAM, CONSUMER_GROUP, MAX_RETRIES};
use crate::producer::move_to_dlq;
use anyhow::Result;

/// Ensure the consumer group exists. Creates it if not present.
pub async fn ensure_consumer_group(
    redis_pool: &deadpool_redis::Pool,
    consumer_name: &str,
) -> Result<()> {
    let mut conn = redis_pool.get().await?;
    // XGROUP CREATE — ignore error if group already exists
    let result: Result<(), _> = redis::cmd("XGROUP")
        .arg("CREATE")
        .arg(VALIDATED_STREAM)
        .arg(CONSUMER_GROUP)
        .arg("0")
        .arg("MKSTREAM")
        .query_async(&mut *conn)
        .await;
    match result {
        Ok(()) => tracing::info!("Consumer group '{}' created for consumer '{}'", CONSUMER_GROUP, consumer_name),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("BUSYGROUP") {
                tracing::debug!("Consumer group '{}' already exists", CONSUMER_GROUP);
            } else {
                return Err(e.into());
            }
        }
    }
    Ok(())
}

/// Read validated bridge events from Redis stream.
/// Returns list of (message_id, ValidationMessage) pairs.
/// Only acknowledges messages after the caller confirms successful processing.
pub async fn consume_validated_events(
    redis_pool: &deadpool_redis::Pool,
    consumer_name: &str,
    count: usize,
) -> Result<Vec<(String, ValidationMessage)>> {
    let mut conn = redis_pool.get().await?;

    let result: redis::Value = redis::cmd("XREADGROUP")
        .arg("GROUP")
        .arg(CONSUMER_GROUP)
        .arg(consumer_name)
        .arg("COUNT")
        .arg(count)
        .arg("BLOCK")
        .arg(5000) // 5 second block timeout
        .arg("STREAMS")
        .arg(VALIDATED_STREAM)
        .arg(">")
        .query_async(&mut *conn)
        .await?;

    let messages = parse_stream_response(result)?;
    Ok(messages)
}

/// Acknowledge a message as successfully processed.
/// Only call this AFTER the message has been fully handled.
pub async fn ack_message(
    redis_pool: &deadpool_redis::Pool,
    message_id: &str,
) -> Result<()> {
    let mut conn = redis_pool.get().await?;
    redis::cmd("XACK")
        .arg(VALIDATED_STREAM)
        .arg(CONSUMER_GROUP)
        .arg(message_id)
        .query_async::<_, i64>(&mut *conn)
        .await?;
    tracing::debug!("Acknowledged message: {}", message_id);
    Ok(())
}

/// Handle a failed message: increment retry count, move to DLQ if max retries exceeded.
pub async fn handle_failure(
    redis_pool: &deadpool_redis::Pool,
    message_id: &str,
    message: &mut ValidationMessage,
    error: &str,
) -> Result<()> {
    message.retry_count += 1;
    if message.retry_count >= MAX_RETRIES {
        move_to_dlq(redis_pool, message, error).await?;
        // Ack the original message since we moved it to DLQ
        ack_message(redis_pool, message_id).await?;
    } else {
        tracing::warn!(
            "Message retry {}/{} for payment_id={}: {}",
            message.retry_count,
            MAX_RETRIES,
            message.payment_id,
            error
        );
        // Don't ack — it will be redelivered by Redis
    }
    Ok(())
}

/// Parse Redis XREADGROUP response into (message_id, ValidationMessage) pairs.
fn parse_stream_response(
    value: redis::Value,
) -> Result<Vec<(String, ValidationMessage)>> {
    let mut results = Vec::new();

    // XREADGROUP returns: [[stream_name, [[msg_id, [field, value, ...]], ...]]]
    if let redis::Value::Array(streams) = value {
        for stream in streams {
            if let redis::Value::Array(parts) = stream {
                if parts.len() >= 2 {
                    if let redis::Value::Array(messages) = &parts[1] {
                        for msg in messages {
                            if let redis::Value::Array(msg_parts) = msg {
                                if msg_parts.len() >= 2 {
                                    let msg_id = match &msg_parts[0] {
                                        redis::Value::BulkString(b) => {
                                            String::from_utf8_lossy(b).to_string()
                                        }
                                        _ => continue,
                                    };
                                    // Parse field-value pairs to find "data"
                                    if let redis::Value::Array(fields) = &msg_parts[1] {
                                        let mut data_str = None;
                                        let mut i = 0;
                                        while i + 1 < fields.len() {
                                            let key = match &fields[i] {
                                                redis::Value::BulkString(b) => {
                                                    String::from_utf8_lossy(b).to_string()
                                                }
                                                _ => {
                                                    i += 2;
                                                    continue;
                                                }
                                            };
                                            if key == "data" {
                                                if let redis::Value::BulkString(b) = &fields[i + 1] {
                                                    data_str = Some(
                                                        String::from_utf8_lossy(b).to_string(),
                                                    );
                                                }
                                            }
                                            i += 2;
                                        }
                                        if let Some(data) = data_str {
                                            match serde_json::from_str::<ValidationMessage>(&data) {
                                                Ok(vm) => results.push((msg_id, vm)),
                                                Err(e) => {
                                                    tracing::error!(
                                                        "Failed to deserialize message: {}",
                                                        e
                                                    );
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}
