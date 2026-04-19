use anyhow::Result;

/// Redis stream consumer for payment events (CRIT-04 fix: use function params, not nonexistent self fields)
pub struct StreamConsumer {
    stream_key: String,
    group: String,
    consumer: String,
}

impl StreamConsumer {
    pub fn new(stream_key: &str, group: &str, consumer: &str) -> Self {
        Self {
            stream_key: stream_key.to_string(),
            group: group.to_string(),
            consumer: consumer.to_string(),
        }
    }

    /// Read messages from Redis stream (CRIT-04 fix: use `pool` param, `count` param)
    pub async fn read(&self, pool: &deadpool_redis::Pool, count: usize) -> Result<Vec<serde_json::Value>> {
        let mut conn = pool.get().await?;
        let result: deadpool_redis::redis::Value = deadpool_redis::redis::cmd("XREADGROUP")
            .arg("GROUP").arg(&self.group).arg(&self.consumer)
            .arg("COUNT").arg(count)
            .arg("BLOCK").arg(5000)
            .arg("STREAMS").arg(&self.stream_key).arg(">")
            .query_async(&mut *conn)
            .await?;

        // Parse XREADGROUP response into Vec<serde_json::Value>
        let messages = Self::parse_stream_response(result)?;
        Ok(messages)
    }

    /// Acknowledge processed message (CRIT-04 fix: use `pool` and `msg_id` params)
    pub async fn ack(&self, pool: &deadpool_redis::Pool, msg_id: &str) -> Result<()> {
        let mut conn = pool.get().await?;
        deadpool_redis::redis::cmd("XACK")
            .arg(&self.stream_key)
            .arg(&self.group)
            .arg(msg_id)
            .query_async::<()>(&mut *conn)
            .await?;
        Ok(())
    }

    /// Ensure the consumer group exists, creating it if needed
    pub async fn ensure_group(&self, pool: &deadpool_redis::Pool) -> Result<()> {
        let mut conn = pool.get().await?;
        // XGROUP CREATE — ignore error if group already exists
        let result: std::result::Result<(), _> = deadpool_redis::redis::cmd("XGROUP")
            .arg("CREATE")
            .arg(&self.stream_key)
            .arg(&self.group)
            .arg("0")
            .arg("MKSTREAM")
            .query_async(&mut *conn)
            .await;
        if let Err(e) = result {
            let err_msg = e.to_string();
            if !err_msg.contains("BUSYGROUP") {
                anyhow::bail!("Failed to create consumer group: {}", e);
            }
            // Group already exists — this is fine
        }
        Ok(())
    }

    /// Parse Redis XREADGROUP response into a list of JSON values
    fn parse_stream_response(value: deadpool_redis::redis::Value) -> Result<Vec<serde_json::Value>> {
        let mut messages = Vec::new();

        // XREADGROUP returns: [[stream_name, [[msg_id, [field, value, ...]], ...]]]
        if let deadpool_redis::redis::Value::Array(streams) = value {
            for stream in streams {
                if let deadpool_redis::redis::Value::Array(stream_data) = stream {
                    // stream_data[1] = [[msg_id, [field, value, ...]], ...]
                    if stream_data.len() >= 2 {
                        if let deadpool_redis::redis::Value::Array(ref entries) = stream_data[1] {
                            for entry in entries {
                                if let deadpool_redis::redis::Value::Array(ref entry_data) = entry {
                                    if entry_data.len() >= 2 {
                                        let msg_id = Self::value_to_string(&entry_data[0]);
                                        let mut fields = serde_json::Map::new();
                                        fields.insert("_msg_id".to_string(), serde_json::Value::String(msg_id));

                                        if let deadpool_redis::redis::Value::Array(ref kvs) = entry_data[1] {
                                            let mut i = 0;
                                            while i + 1 < kvs.len() {
                                                let key = Self::value_to_string(&kvs[i]);
                                                let val = Self::value_to_string(&kvs[i + 1]);
                                                fields.insert(key, serde_json::Value::String(val));
                                                i += 2;
                                            }
                                        }
                                        messages.push(serde_json::Value::Object(fields));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(messages)
    }

    fn value_to_string(val: &deadpool_redis::redis::Value) -> String {
        match val {
            deadpool_redis::redis::Value::BulkString(bytes) => {
                String::from_utf8_lossy(bytes).to_string()
            }
            deadpool_redis::redis::Value::SimpleString(s) => s.clone(),
            deadpool_redis::redis::Value::Int(i) => i.to_string(),
            _ => String::new(),
        }
    }
}
