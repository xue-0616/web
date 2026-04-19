//! Redis stream wrapper.
//!
//! The closed-source binary kept one stream per chain (key pattern
//! `asset_migrator:{chain_name}:inbound_events`) and enforced a
//! `stream_max_len` cap via `XADD … MAXLEN ~`. We mirror that here.

use deadpool_redis::Pool;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};

pub type RedisPool = Pool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboundEvent {
    pub chain_name: String,
    pub coin_name: String,
    #[serde(with = "hex::serde")]
    pub tx_hash: Vec<u8>,
    pub block_number: u64,
    pub event_source: String,
    pub event_source_id: String,
}

pub fn inbound_stream_key(chain_name: &str) -> String {
    format!("asset_migrator:{chain_name}:inbound_events")
}

pub async fn enqueue(
    pool: &RedisPool,
    stream_max_len: usize,
    event: &InboundEvent,
) -> Result<(), crate::error::Error> {
    let mut conn = pool.get().await.map_err(|e| crate::error::Error::Internal(e.to_string()))?;
    let key = inbound_stream_key(&event.chain_name);
    let payload = serde_json::to_string(event)
        .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
    let _: String = conn
        .xadd_maxlen(
            key,
            redis::streams::StreamMaxlen::Approx(stream_max_len),
            "*",
            &[("payload", payload)],
        )
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_key_format_is_stable() {
        assert_eq!(
            inbound_stream_key("ethereum"),
            "asset_migrator:ethereum:inbound_events"
        );
    }

    #[test]
    fn inbound_event_serde_roundtrip() {
        let ev = InboundEvent {
            chain_name: "eth".into(),
            coin_name: "USDC".into(),
            tx_hash: vec![0xde, 0xad, 0xbe, 0xef],
            block_number: 100,
            event_source: "source".into(),
            event_source_id: "source-1".into(),
        };
        let json = serde_json::to_string(&ev).unwrap();
        assert!(json.contains("deadbeef"));
        let back: InboundEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(back.tx_hash, ev.tx_hash);
        assert_eq!(back.block_number, ev.block_number);
    }
}
