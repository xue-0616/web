// Collection of recording payments

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingPayments {
    pub id: u64,
    pub tx_hash: Option<String>,
    pub status: String,
}
