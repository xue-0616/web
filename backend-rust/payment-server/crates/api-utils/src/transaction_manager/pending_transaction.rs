// Pending transaction state — tracks nonce, retries, gas bumps

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingTransaction {
    pub id: u64,
    pub status: String,
}
