pub use sea_orm_migration::prelude::*;

mod m20240515_072853_create_scripts;
mod m20240515_073411_create_tokens;
mod m20240515_073416_create_pools;
mod m20240518_084524_create_pool_txs;
mod m20240524_105140_update_intents;
mod m20240527_122704_update_intents;
mod m20240528_025500_create_pool_statistics;
mod m20240530_025229_update_tokens;
mod m20240530_110427_update_tokens;
mod m20240604_081953_update_pool_txs;
mod m20240605_084159_update_pool_txs;
mod m20240606_114226_update_intents;
mod m20240624_060235_update_intent_transactions;
mod m20240704_100612_create_accounts;
mod m20240709_083725_create_points_history;
mod m20241008_064931_update_intents;

pub struct Migrator;

/// SECURITY (L-24): Migration version — increment when adding new migrations
/// Used to verify migration compatibility before running
pub const MIGRATION_VERSION: u32 = 16;

/// SECURITY (L-24): Verify migration count matches expected version
/// This catches accidental migration file deletions or ordering issues
pub fn verify_migration_count() -> Result<(), String> {
    let migrations = <Migrator as MigratorTrait>::migrations();
    if migrations.len() != MIGRATION_VERSION as usize {
        return Err(format!(
            "Migration count mismatch: expected {} migrations (MIGRATION_VERSION), found {}. \
             This may indicate missing or duplicate migration files.",
            MIGRATION_VERSION,
            migrations.len()
        ));
    }
    Ok(())
}

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20240515_072853_create_scripts::Migration),
            Box::new(m20240515_073411_create_tokens::Migration),
            Box::new(m20240515_073416_create_pools::Migration),
            Box::new(m20240518_084524_create_pool_txs::Migration),
            Box::new(m20240524_105140_update_intents::Migration),
            Box::new(m20240527_122704_update_intents::Migration),
            Box::new(m20240528_025500_create_pool_statistics::Migration),
            Box::new(m20240530_025229_update_tokens::Migration),
            Box::new(m20240530_110427_update_tokens::Migration),
            Box::new(m20240604_081953_update_pool_txs::Migration),
            Box::new(m20240605_084159_update_pool_txs::Migration),
            Box::new(m20240606_114226_update_intents::Migration),
            Box::new(m20240624_060235_update_intent_transactions::Migration),
            Box::new(m20240704_100612_create_accounts::Migration),
            Box::new(m20240709_083725_create_points_history::Migration),
            Box::new(m20241008_064931_update_intents::Migration),
        ]
    }
}
