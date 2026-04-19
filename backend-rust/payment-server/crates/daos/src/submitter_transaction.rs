use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "submitter_transaction")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub payment_id: u64, pub chain_id: u64, pub tx_hash: Option<Vec<u8>>, pub nonce: Option<i64>, pub status: String, pub created_at: chrono::NaiveDateTime, pub updated_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
