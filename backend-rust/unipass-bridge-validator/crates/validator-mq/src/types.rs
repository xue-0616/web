/// Message queue types for bridge validation events
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationMessage {
    pub payment_id: u64,
    pub source_chain_id: u64,
    pub dest_chain_id: u64,
    pub tx_hash: String,
    pub log_index: u32,
    pub sender: String,
    pub recipient: String,
    pub token: String,
    pub amount: String,
    pub signature: String,
    pub validated: bool,
    pub retry_count: u32,
}

/// Stream keys for Redis
pub const VALIDATED_STREAM: &str = "bridge:validated";
pub const DLQ_STREAM: &str = "bridge:dlq";
pub const CONSUMER_GROUP: &str = "bridge-validators";
pub const MAX_RETRIES: u32 = 3;
