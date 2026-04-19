// Coins.ph pending order tracking

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOrder {
    pub id: u64,
    pub status: String,
}
