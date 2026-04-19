//! sqlx DAOs for the 2 snap tables.

pub mod snap_account;
pub mod snap_account_transaction;

use sqlx::MySqlPool;

pub async fn migrate(pool: &MySqlPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
