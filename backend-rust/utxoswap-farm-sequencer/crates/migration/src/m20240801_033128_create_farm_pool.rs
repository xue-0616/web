use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(FarmPools::Table)
                .if_not_exists()
                .col(ColumnDef::new(FarmPools::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(FarmPools::PoolTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(FarmPools::RewardTokenTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(FarmPools::LpTokenTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(FarmPools::FarmTypeHash).binary_len(32).not_null().unique_key())
                .col(ColumnDef::new(FarmPools::Creator).binary_len(32).not_null())
                .col(ColumnDef::new(FarmPools::TotalStaked).decimal_len(40, 0).not_null().default("0"))
                .col(ColumnDef::new(FarmPools::RewardPerSecond).decimal_len(40, 0).not_null())
                .col(ColumnDef::new(FarmPools::AccRewardPerShare).decimal_len(50, 18).not_null().default("0"))
                .col(ColumnDef::new(FarmPools::StartTime).date_time().not_null())
                .col(ColumnDef::new(FarmPools::EndTime).date_time().not_null())
                .col(ColumnDef::new(FarmPools::LastRewardTime).date_time().not_null())
                .col(ColumnDef::new(FarmPools::Status).tiny_integer().not_null().default(0))
                .col(ColumnDef::new(FarmPools::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(FarmPools::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(FarmPools::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum FarmPools {
    Table, Id, PoolTypeHash, RewardTokenTypeHash, LpTokenTypeHash, FarmTypeHash,
    Creator, TotalStaked, RewardPerSecond, AccRewardPerShare, StartTime, EndTime,
    LastRewardTime, Status, CreatedAt, UpdatedAt,
}
