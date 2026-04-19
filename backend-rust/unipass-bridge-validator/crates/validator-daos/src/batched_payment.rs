use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "batched_payment")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub batch_id: String, pub chain_id: u64, pub tx_hash: Option<Vec<u8>>, pub payment_count: u32, pub status: String, pub created_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
