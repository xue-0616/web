use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "bridge_event")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub chain_id: u64, pub block_number: u64, pub tx_hash: Vec<u8>, pub log_index: u32, pub event_type: String, pub data: String, pub created_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
