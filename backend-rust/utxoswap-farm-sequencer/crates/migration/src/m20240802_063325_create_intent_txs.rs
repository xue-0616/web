use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(IntentTxs::Table)
                .if_not_exists()
                .col(ColumnDef::new(IntentTxs::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(IntentTxs::IntentId).big_unsigned().not_null())
                .col(ColumnDef::new(IntentTxs::TxHash).binary_len(32).not_null())
                .col(ColumnDef::new(IntentTxs::Status).tiny_integer().not_null().default(0))
                .col(ColumnDef::new(IntentTxs::ErrorMsg).string_len(1024).null())
                .col(ColumnDef::new(IntentTxs::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(IntentTxs::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await?;
        manager.create_index(
            Index::create().table(IntentTxs::Table).name("idx_intent_txs_intent_id")
                .col(IntentTxs::IntentId).to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(IntentTxs::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum IntentTxs {
    Table, Id, IntentId, TxHash, Status, ErrorMsg, CreatedAt, UpdatedAt,
}
