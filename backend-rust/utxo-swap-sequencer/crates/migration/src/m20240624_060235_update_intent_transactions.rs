use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(IntentTransactions::Table)
                .if_not_exists()
                .col(ColumnDef::new(IntentTransactions::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(IntentTransactions::IntentId).big_unsigned().not_null())
                .col(ColumnDef::new(IntentTransactions::TxHash).binary_len(32).not_null())
                .col(ColumnDef::new(IntentTransactions::Status).tiny_integer().not_null().default(0))
                .col(ColumnDef::new(IntentTransactions::ErrorMsg).string_len(1024).null())
                .col(ColumnDef::new(IntentTransactions::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(IntentTransactions::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await?;
        manager.create_index(
            Index::create().table(IntentTransactions::Table).name("idx_intent_tx_intent_id")
                .col(IntentTransactions::IntentId).to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(IntentTransactions::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum IntentTransactions {
    Table, Id, IntentId, TxHash, Status, ErrorMsg, CreatedAt, UpdatedAt,
}
