use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_index(
            Index::create().table(Alias::new("pool_txs")).name("idx_pool_txs_batch_id")
                .col(Alias::new("batch_id")).to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_index(Index::drop().name("idx_pool_txs_batch_id").table(Alias::new("pool_txs")).to_owned()).await
    }
}
