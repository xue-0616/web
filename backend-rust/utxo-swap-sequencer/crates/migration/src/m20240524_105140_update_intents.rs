use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(Intents::Table)
                .if_not_exists()
                .col(ColumnDef::new(Intents::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(Intents::IntentType).tiny_integer().not_null())
                .col(ColumnDef::new(Intents::CellIndex).unsigned().not_null())
                .col(ColumnDef::new(Intents::CellTxHash).binary_len(32).not_null())
                .col(ColumnDef::new(Intents::PoolTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Intents::AssetXTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Intents::AssetYTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Intents::SwapType).tiny_integer().null())
                .col(ColumnDef::new(Intents::AmountIn).decimal_len(40, 0).not_null())
                .col(ColumnDef::new(Intents::AmountOut).decimal_len(40, 0).not_null())
                .col(ColumnDef::new(Intents::MinAmount).decimal_len(40, 0).not_null())
                .col(ColumnDef::new(Intents::LockHash).binary_len(32).not_null())
                .col(ColumnDef::new(Intents::LockCodeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Intents::LockArgs).var_binary(512).not_null())
                .col(ColumnDef::new(Intents::Status).tiny_integer().not_null().default(0))
                .col(ColumnDef::new(Intents::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(Intents::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await?;
        manager.create_index(
            Index::create().table(Intents::Table).name("idx_intents_pool_status")
                .col(Intents::PoolTypeHash).col(Intents::Status).to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Intents::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum Intents {
    Table, Id, IntentType, CellIndex, CellTxHash, PoolTypeHash, AssetXTypeHash, AssetYTypeHash,
    SwapType, AmountIn, AmountOut, MinAmount, LockHash, LockCodeHash, LockArgs, Status,
    CreatedAt, UpdatedAt,
}
