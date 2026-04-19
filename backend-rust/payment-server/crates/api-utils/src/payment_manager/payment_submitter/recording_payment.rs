// Recording payment — tracking confirmed payments for accounting

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingPayment {
    pub id: u64,
    pub tx_hash: Option<String>,
    pub status: String,
}
