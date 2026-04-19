use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(Scripts::Table)
                .if_not_exists()
                .col(ColumnDef::new(Scripts::ScriptHash).binary_len(32).not_null().primary_key())
                .col(ColumnDef::new(Scripts::CodeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Scripts::HashType).tiny_integer().not_null())
                .col(ColumnDef::new(Scripts::Args).var_binary(512).not_null())
                .col(ColumnDef::new(Scripts::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(Scripts::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Scripts::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum Scripts {
    Table, ScriptHash, CodeHash, HashType, Args, CreatedAt, UpdatedAt,
}
