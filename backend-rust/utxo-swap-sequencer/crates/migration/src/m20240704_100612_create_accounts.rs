use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(Accounts::Table)
                .if_not_exists()
                .col(ColumnDef::new(Accounts::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(Accounts::LockHash).binary_len(32).not_null().unique_key())
                .col(ColumnDef::new(Accounts::WalletTypes).string_len(1024).not_null().default(""))
                .col(ColumnDef::new(Accounts::TotalPoints).big_unsigned().not_null().default(0))
                .col(ColumnDef::new(Accounts::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(Accounts::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Accounts::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum Accounts {
    Table, Id, LockHash, WalletTypes, TotalPoints, CreatedAt, UpdatedAt,
}
