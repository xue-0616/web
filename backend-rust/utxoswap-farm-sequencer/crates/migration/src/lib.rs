pub use sea_orm_migration::prelude::*;

mod m20240801_033128_create_farm_pool;
mod m20240801_061617_create_farm_intents;
mod m20240801_063617_create_batch_txs;
mod m20240802_063325_create_intent_txs;
mod m20240802_110942_create_scripts;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20240801_033128_create_farm_pool::Migration),
            Box::new(m20240801_061617_create_farm_intents::Migration),
            Box::new(m20240801_063617_create_batch_txs::Migration),
            Box::new(m20240802_063325_create_intent_txs::Migration),
            Box::new(m20240802_110942_create_scripts::Migration),
        ]
    }
}
