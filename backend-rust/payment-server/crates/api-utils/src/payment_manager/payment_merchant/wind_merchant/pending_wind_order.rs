// Wind pending order tracking

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingWindOrder {
    pub id: u64,
    pub status: String,
}
