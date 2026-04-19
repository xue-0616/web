use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(Pools::Table)
                .if_not_exists()
                .col(ColumnDef::new(Pools::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(Pools::Creator).binary_len(32).not_null())
                .col(ColumnDef::new(Pools::AssetXTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Pools::AssetYTypeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Pools::TypeHash).binary_len(32).not_null().unique_key())
                .col(ColumnDef::new(Pools::TypeCodeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Pools::TypeHashType).tiny_integer().not_null())
                .col(ColumnDef::new(Pools::TypeArgs).var_binary(512).not_null())
                .col(ColumnDef::new(Pools::LpSymbol).string_len(32).not_null())
                .col(ColumnDef::new(Pools::LpName).string_len(256).not_null())
                .col(ColumnDef::new(Pools::LpDecimals).tiny_unsigned().not_null().default(8))
                .col(ColumnDef::new(Pools::Tvl).decimal_len(50, 9).null())
                .col(ColumnDef::new(Pools::DayTxsCount).big_unsigned().null())
                .col(ColumnDef::new(Pools::TotalTxsCount).big_unsigned().null())
                .col(ColumnDef::new(Pools::DayVolume).decimal_len(50, 9).null())
                .col(ColumnDef::new(Pools::AssetXAmount).decimal_len(40, 0).null())
                .col(ColumnDef::new(Pools::AssetYAmount).decimal_len(40, 0).null())
                .col(ColumnDef::new(Pools::BasedAsset).tiny_integer().null())
                .col(ColumnDef::new(Pools::BasedAssetPrice).decimal_len(50, 9).null())
                .col(ColumnDef::new(Pools::BasedAssetDecimals).tiny_unsigned().null())
                .col(ColumnDef::new(Pools::TotalVolume).decimal_len(50, 9).null())
                .col(ColumnDef::new(Pools::DayApr).decimal_len(50, 9).null())
                .col(ColumnDef::new(Pools::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(Pools::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Pools::Table).to_owned()).await
    }
}

#[derive(Iden)]
#[allow(clippy::enum_variant_names)]
enum Pools {
    Table, Id, Creator, AssetXTypeHash, AssetYTypeHash, TypeHash, TypeCodeHash, TypeHashType,
    TypeArgs, LpSymbol, LpName, LpDecimals, Tvl, DayTxsCount, TotalTxsCount, DayVolume,
    AssetXAmount, AssetYAmount, BasedAsset, BasedAssetPrice, BasedAssetDecimals,
    TotalVolume, DayApr, CreatedAt, UpdatedAt,
}
