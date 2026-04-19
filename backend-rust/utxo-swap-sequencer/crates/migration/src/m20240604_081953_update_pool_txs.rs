use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_index(
            Index::create().table(Alias::new("pool_txs")).name("idx_pool_txs_pool_hash")
                .col(Alias::new("pool_type_hash")).to_owned(),
        ).await?;
        manager.create_index(
            Index::create().table(Alias::new("pool_txs")).name("idx_pool_txs_status")
                .col(Alias::new("status")).to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_index(Index::drop().name("idx_pool_txs_pool_hash").table(Alias::new("pool_txs")).to_owned()).await?;
        manager.drop_index(Index::drop().name("idx_pool_txs_status").table(Alias::new("pool_txs")).to_owned()).await
    }
}
