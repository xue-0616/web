//! Background workers.
//!
//! Three long-running tasks, each a separate tokio task under the same
//! shutdown signal:
//!
//!   1. [`deposit_indexer`] — walks the chain head per inbound chain,
//!      publishing `InboundEvent`s to Redis when a deposit address
//!      receives funds.
//!   2. [`tx_processor`] — consumes Redis events, writes
//!      `inbound_transaction` rows, builds outbound txs, and enqueues
//!      them for the submitter.
//!   3. [`submitter`] — signs outbound txs via the custody wallet and
//!      broadcasts them to destination chain RPC.
//!
//! The closed-source ELF implemented these under crates `workers` /
//! `tx_processor` / `submitter` (see symbol table). We keep the same
//! division so each has a single-responsibility surface area.

pub mod deposit_indexer;
pub mod submitter;
pub mod tx_processor;

use std::sync::Arc;
use tokio::sync::watch;

/// Handle for the caller to request shutdown. Dropping or sending `true`
/// both terminate the workers gracefully.
pub type Shutdown = watch::Receiver<bool>;

#[derive(Clone)]
pub struct Context {
    pub db: sqlx::MySqlPool,
    pub redis: crate::mq::RedisPool,
    pub custody: Arc<dyn crate::services::custody_wallet::CustodyWalletClient>,
    pub config: Arc<crate::config::AssetMigratorConfigs>,
}
