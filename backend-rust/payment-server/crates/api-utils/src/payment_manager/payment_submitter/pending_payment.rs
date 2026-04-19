// Single pending payment state machine

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingPayment {
    pub id: u64,
    pub status: String,
}
