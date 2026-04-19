use serde::{Deserialize, Serialize};

/// Order kind drives retry policy. Buy is more fragile than sell because
/// retry-chasing a buy after slippage already burned means paying a worse
/// price. A position that needs to EXIT on the other hand must retry
/// aggressively — stuck tokens lose value over time.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderKind {
    Buy,
    Sell,
}

impl Default for OrderKind {
    fn default() -> Self { Self::Buy }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingTransaction {
    pub order_id: String,
    pub signature: Option<String>,
    pub tx_bytes: Vec<u8>,
    pub is_anti_mev: bool,
    /// Jito tip amount in lamports (0 = use dynamic tip from tip floor API)
    pub bribery_amount: u64,
    /// Consensus vote count for signal-strength-aware routing
    pub consensus_votes: u32,
    pub retry_count: u32,
    pub max_retries: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Order kind — differentiates retry policy between buys and sells.
    /// Default `Buy` preserves backward-compatible behavior for callers that
    /// don't set this explicitly.
    #[serde(default)]
    pub order_kind: OrderKind,
}

impl PendingTransaction {
    pub fn new(order_id: &str, tx_bytes: Vec<u8>, is_anti_mev: bool) -> Self {
        Self {
            order_id: order_id.to_string(),
            signature: None,
            tx_bytes,
            is_anti_mev,
            bribery_amount: 0,
            consensus_votes: 0,
            retry_count: 0,
            max_retries: 3,
            created_at: chrono::Utc::now(),
            order_kind: OrderKind::Buy,
        }
    }

    pub fn with_tip(mut self, bribery_amount: u64, consensus_votes: u32) -> Self {
        self.bribery_amount = bribery_amount;
        self.consensus_votes = consensus_votes;
        self
    }

    pub fn with_order_kind(mut self, kind: OrderKind) -> Self {
        self.order_kind = kind;
        self
    }

    pub fn should_retry(&self) -> bool {
        self.retry_count < self.max_retries
    }
}
