// Pending pool — tracks pool creation requests before on-chain confirmation

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingPool {
    pub id: u64,
    pub status: String,
}
