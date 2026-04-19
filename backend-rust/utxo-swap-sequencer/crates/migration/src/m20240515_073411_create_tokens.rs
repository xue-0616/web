use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(Tokens::Table)
                .if_not_exists()
                .col(ColumnDef::new(Tokens::Id).big_unsigned().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(Tokens::Logo).string_len(1024).null())
                .col(ColumnDef::new(Tokens::Symbol).string_len(32).not_null())
                .col(ColumnDef::new(Tokens::Name).string_len(256).not_null())
                .col(ColumnDef::new(Tokens::Decimals).tiny_unsigned().not_null())
                .col(ColumnDef::new(Tokens::TypeHash).binary_len(32).not_null().unique_key())
                .col(ColumnDef::new(Tokens::TypeCodeHash).binary_len(32).not_null())
                .col(ColumnDef::new(Tokens::TypeArgs).var_binary(512).not_null())
                .col(ColumnDef::new(Tokens::TypeHashType).tiny_integer().not_null())
                .col(ColumnDef::new(Tokens::Type).tiny_integer().not_null().default(0))
                .col(ColumnDef::new(Tokens::CreatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP".to_string()))
                .col(ColumnDef::new(Tokens::UpdatedAt).date_time().not_null().extra("DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP".to_string()))
                .to_owned(),
        ).await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Tokens::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum Tokens {
    Table, Id, Logo, Symbol, Name, Decimals, TypeHash, TypeCodeHash, TypeArgs, TypeHashType,
    #[iden = "type"]
    Type,
    CreatedAt, UpdatedAt,
}
