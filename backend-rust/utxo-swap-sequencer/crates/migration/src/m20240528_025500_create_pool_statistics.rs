use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(PoolStatistics::Table)
                .if_not_exists()
                .col(ColumnDef::new(PoolStatistics::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(PoolStatistics::PoolTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(PoolStatistics::AssetXAmount).decimal_len(40, 0).null())
                .col(ColumnDef::new(PoolStatistics::AssetYAmount).decimal_len(40, 0).null())
                .col(ColumnDef::new(PoolStatistics::Price).decimal_len(50, 9).null())
                .col(ColumnDef::new(PoolStatistics::Tvl).decimal_len(50, 9).null())
                .col(ColumnDef::new(PoolStatistics::Volume).decimal_len(50, 9).null())
                .col(ColumnDef::new(PoolStatistics::TxsCount).big_unsigned().null())
                .col(ColumnDef::new(PoolStatistics::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await?;
        manager.create_index(
            Index::create().table(PoolStatistics::Table).name("idx_pool_statistics_pool_hash")
                .col(PoolStatistics::PoolTypeHash).to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(PoolStatistics::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum PoolStatistics {
    Table, Id, PoolTypeHash, AssetXAmount, AssetYAmount, Price, Tvl, Volume, TxsCount, CreatedAt,
}
