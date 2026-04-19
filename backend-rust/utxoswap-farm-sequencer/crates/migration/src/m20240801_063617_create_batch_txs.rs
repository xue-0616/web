use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(BatchTxs::Table)
                .if_not_exists()
                .col(ColumnDef::new(BatchTxs::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(BatchTxs::FarmTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(BatchTxs::TxHash).binary_len(32).not_null())
                .col(ColumnDef::new(BatchTxs::Tx).blob(sea_orm_migration::sea_query::BlobSize::Medium).not_null())
                .col(ColumnDef::new(BatchTxs::BatchId).big_unsigned().not_null())
                .col(ColumnDef::new(BatchTxs::BlockNumber).big_unsigned().null())
                .col(ColumnDef::new(BatchTxs::IntentIds).string_len(10240).not_null())
                .col(ColumnDef::new(BatchTxs::RefundedIntentIds).json().null())
                .col(ColumnDef::new(BatchTxs::IntentEvents).json().null())
                .col(ColumnDef::new(BatchTxs::ErrorReason).string_len(1024).null())
                .col(ColumnDef::new(BatchTxs::Status).tiny_integer().not_null().default(0))
                .col(ColumnDef::new(BatchTxs::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(BatchTxs::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(BatchTxs::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum BatchTxs {
    Table, Id, FarmTypeHash, TxHash, Tx, BatchId, BlockNumber, IntentIds,
    RefundedIntentIds, IntentEvents, ErrorReason, Status, CreatedAt, UpdatedAt,
}
