use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.alter_table(
            Table::alter().table(Alias::new("intents"))
                .add_column(ColumnDef::new(Alias::new("api_key")).string_len(40).null())
                .add_column(ColumnDef::new(Alias::new("wallet_type")).string_len(20).null())
                .to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.alter_table(
            Table::alter().table(Alias::new("intents"))
                .drop_column(Alias::new("api_key"))
                .drop_column(Alias::new("wallet_type"))
                .to_owned(),
        ).await
    }
}
