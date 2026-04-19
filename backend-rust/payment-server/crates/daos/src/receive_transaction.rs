use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "receive_transaction")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub user_id: u64, pub chain_id: u64, pub tx_hash: Vec<u8>, pub from_address: Vec<u8>, pub token_address: Option<Vec<u8>>, pub amount: String, pub created_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
