use sea_orm::DatabaseConnection;
use std::sync::Arc;

/// Lightweight swap job that can be sent through the tx channel
#[derive(Debug, Clone)]
pub struct SwapJob {
    pub order_id: String,
    pub tx_bytes: Vec<u8>,
    pub is_anti_mev: bool,
    /// Jito tip amount in lamports (separate from Jupiter priority fee)
    pub bribery_amount: u64,
    /// Consensus vote count for signal-strength-aware routing
    pub consensus_votes: u32,
    /// True if this swap is a SELL — enables aggressive sell-retry policy in
    /// tx_submitter runner (sells must exit even with tip escalation).
    pub is_sell: bool,
}

#[derive(Clone)]
pub struct AppContext {
    db: DatabaseConnection,
    pub solana_rpc_url: String,
    pub jupiter_url: String,
    pub jupiter_api_key: String,
    pub tx_submitter_private_key: String,
    pub slack_webhook: String,
    pub tx_sender: Option<Arc<tokio::sync::mpsc::Sender<SwapJob>>>,
}

impl AppContext {
    pub fn new(db: DatabaseConnection, config: impl Into<AppContextConfig>) -> Self {
        let c: AppContextConfig = config.into();
        Self {
            db,
            solana_rpc_url: c.solana_rpc_url,
            jupiter_url: c.jupiter_url,
            jupiter_api_key: c.jupiter_api_key,
            tx_submitter_private_key: c.tx_submitter_private_key,
            slack_webhook: c.slack_webhook,
            tx_sender: None,
        }
    }
    pub fn with_tx_sender(mut self, sender: tokio::sync::mpsc::Sender<SwapJob>) -> Self {
        self.tx_sender = Some(Arc::new(sender));
        self
    }
    pub fn db(&self) -> &DatabaseConnection { &self.db }
}

#[derive(Clone)]
pub struct AppContextConfig {
    pub solana_rpc_url: String,
    pub jupiter_url: String,
    pub jupiter_api_key: String,
    pub tx_submitter_private_key: String,
    pub slack_webhook: String,
}
