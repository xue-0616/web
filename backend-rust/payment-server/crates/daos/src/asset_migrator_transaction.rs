use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "asset_migrator_transaction")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub user_id: u64, pub from_chain_id: u64, pub to_chain_id: u64, pub token_address: Vec<u8>, pub amount: String, pub status: String, pub created_at: chrono::NaiveDateTime, pub updated_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
