use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(PoolTxs::Table)
                .if_not_exists()
                .col(ColumnDef::new(PoolTxs::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(PoolTxs::PoolTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(PoolTxs::TxHash).binary_len(32).not_null())
                .col(ColumnDef::new(PoolTxs::Tx).blob(sea_orm_migration::sea_query::BlobSize::Medium).not_null())
                .col(ColumnDef::new(PoolTxs::BatchId).big_unsigned().not_null())
                .col(ColumnDef::new(PoolTxs::BlockNumber).big_unsigned().null())
                .col(ColumnDef::new(PoolTxs::IntentIds).string_len(10240).not_null())
                .col(ColumnDef::new(PoolTxs::RefundedIntentIds).json().null())
                .col(ColumnDef::new(PoolTxs::IntentEvents).json().null())
                .col(ColumnDef::new(PoolTxs::ErrorReason).string_len(1024).null())
                .col(ColumnDef::new(PoolTxs::Status).tiny_integer().not_null().default(0))
                .col(ColumnDef::new(PoolTxs::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(PoolTxs::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(PoolTxs::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum PoolTxs {
    Table, Id, PoolTypeHash, TxHash, Tx, BatchId, BlockNumber, IntentIds,
    RefundedIntentIds, IntentEvents, ErrorReason, Status, CreatedAt, UpdatedAt,
}
