//! Redis consumer that drains `asset_migrator:<chain>:inbound_events` and
//! converts each event to an outbound tx:
//!
//! 1. Read event from Redis (XREADGROUP with a fixed consumer group name).
//! 2. Upsert `inbound_transaction` row (idempotent on (coin_name, tx_hash)).
//! 3. Look up the matching `outbound_coin_info` by the inbound coin's
//!    `outbound_chain_id`+`outbound_coin`; fail fast if unmapped.
//! 4. Insert a `outbound_transaction` row with `status='prepared'`.
//! 5. Insert/update `tx_activity` row to correlate inbound ↔ outbound.
//! 6. Ack the Redis message (XACK) — IDEMPOTENCY boundary. A process
//!    crash between step 4 and step 6 will replay, but step 2's
//!    `ON DUPLICATE KEY UPDATE` and step 4's unique-on-(chain_id,
//!    token_address, tx_hash) keep things consistent.
//!
//! TODO(oss): implement the inner pipeline per the comment block above;
//! `workers::tx_processor` in the ELF has 22 symbols covering this.

use super::{Context, Shutdown};

pub async fn run(_ctx: Context, mut shutdown: Shutdown) {
    tracing::info!("tx_processor started");
    loop {
        tokio::select! {
            biased;
            _ = shutdown.changed() => {
                tracing::info!("tx_processor shutdown");
                return;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(1)) => {
                tracing::debug!("tx_processor tick — stub");
            }
        }
    }
}
