use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "validator_output")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub payment_id: u64, pub chain_id: u64, pub token_address: Vec<u8>, pub amount: String, pub recipient: Vec<u8> }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
