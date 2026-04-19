use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.alter_table(
            Table::alter().table(Alias::new("intents"))
                .add_column(ColumnDef::new(Alias::new("asset_x_in_index")).unsigned().null())
                .to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.alter_table(
            Table::alter().table(Alias::new("intents"))
                .drop_column(Alias::new("asset_x_in_index"))
                .to_owned(),
        ).await
    }
}
