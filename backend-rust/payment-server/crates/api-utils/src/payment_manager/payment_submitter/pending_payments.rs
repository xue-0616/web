// Collection of pending payments being processed

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingPayments {
    pub id: u64,
    pub status: String,
}
