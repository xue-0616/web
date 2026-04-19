use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(PointsHistory::Table)
                .if_not_exists()
                .col(ColumnDef::new(PointsHistory::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(PointsHistory::AccountId).big_unsigned().not_null())
                .col(ColumnDef::new(PointsHistory::Points).big_unsigned().not_null())
                .col(ColumnDef::new(PointsHistory::SourceType).tiny_integer().not_null())
                .col(ColumnDef::new(PointsHistory::SourceId).big_unsigned().not_null())
                .col(ColumnDef::new(PointsHistory::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(PointsHistory::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await?;
        manager.create_index(
            Index::create().table(PointsHistory::Table).name("idx_points_history_account")
                .col(PointsHistory::AccountId).to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(PointsHistory::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum PointsHistory {
    Table, Id, AccountId, Points, SourceType, SourceId, CreatedAt, UpdatedAt,
}
