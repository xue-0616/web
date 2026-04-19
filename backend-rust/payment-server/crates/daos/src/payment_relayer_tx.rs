use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "payment_relayer_tx")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub payment_id: u64, pub chain_id: u64, pub tx_hash: Option<Vec<u8>>, pub status: String, pub error_msg: Option<String>, pub created_at: chrono::NaiveDateTime, pub updated_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
