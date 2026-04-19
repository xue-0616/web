use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "chain_info")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub chain_id: u64, pub chain_name: String, pub rpc_url: String, pub bridge_contract: Vec<u8>, pub last_synced_block: u64 }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
