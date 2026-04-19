use serde::{Deserialize, Serialize};

/// A single item consumed from the asset migration Redis stream
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionConsumerItem {
    pub migration_id: u64,
    pub source_chain_id: u64,
    pub dest_chain_id: u64,
    pub user_address: String,
    pub token_address: String,
    pub amount: String,
    pub status: String,
    pub tx_hash: Option<String>,
}
