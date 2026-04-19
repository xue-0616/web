use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_index(
            Index::create().table(Alias::new("tokens")).name("idx_tokens_symbol")
                .col(Alias::new("symbol")).to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_index(Index::drop().name("idx_tokens_symbol").table(Alias::new("tokens")).to_owned()).await
    }
}
