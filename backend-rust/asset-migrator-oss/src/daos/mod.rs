//! sqlx DAO layer for the 6 tables.
//!
//! Each sub-module owns one table's struct + query helpers. Enums
//! (`CoinPurpose`, `DepositAddressStatus`, …) are kept alongside their
//! owning entity so the invariants stay local.
//!
//! All timestamps use `chrono::NaiveDateTime` to match the MySQL `datetime`
//! column type (no TZ info). If we later migrate to `TIMESTAMP WITH TIME
//! ZONE` we can swap in `DateTime<Utc>` with a simple `sqlx::Type` impl.

pub mod coin_info;
pub mod deposit_address;
pub mod deposit_event;
pub mod inbound_transaction;
pub mod outbound_transaction;
pub mod tx_activity;

use sqlx::MySqlPool;

/// Runs all embedded migrations. Called once at service startup.
pub async fn migrate(pool: &MySqlPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
