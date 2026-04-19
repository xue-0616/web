use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(FarmIntents::Table)
                .if_not_exists()
                .col(ColumnDef::new(FarmIntents::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(FarmIntents::IntentType).tiny_integer().not_null())
                .col(ColumnDef::new(FarmIntents::FarmTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(FarmIntents::CellTxHash).binary_len(32).not_null())
                .col(ColumnDef::new(FarmIntents::CellIndex).unsigned().not_null())
                .col(ColumnDef::new(FarmIntents::LockHash).binary_len(32).not_null())
                .col(ColumnDef::new(FarmIntents::Amount).decimal_len(40, 0).not_null())
                .col(ColumnDef::new(FarmIntents::RewardAmount).decimal_len(40, 0).null())
                .col(ColumnDef::new(FarmIntents::BatchTxHash).binary_len(32).null())
                .col(ColumnDef::new(FarmIntents::ErrorReason).json().null())
                .col(ColumnDef::new(FarmIntents::Status).tiny_integer().not_null().default(0))
                .col(ColumnDef::new(FarmIntents::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(FarmIntents::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await?;
        manager.create_index(
            Index::create().table(FarmIntents::Table).name("idx_farm_intents_farm_status")
                .col(FarmIntents::FarmTypeHash).col(FarmIntents::Status).to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(FarmIntents::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum FarmIntents {
    Table, Id, IntentType, FarmTypeHash, CellTxHash, CellIndex, LockHash,
    Amount, RewardAmount, BatchTxHash, ErrorReason, Status, CreatedAt, UpdatedAt,
}
