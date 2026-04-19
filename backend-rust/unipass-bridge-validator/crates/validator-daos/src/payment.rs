use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "validator_payment")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub source_chain_id: u64, pub dest_chain_id: u64, pub tx_hash: Vec<u8>, pub token_address: Vec<u8>, pub recipient: Vec<u8>, pub amount: String, pub status: String, pub created_at: chrono::NaiveDateTime, pub updated_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
