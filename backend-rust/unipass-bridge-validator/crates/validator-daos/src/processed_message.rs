use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Replay protection: tracks processed bridge messages.
/// Unique constraint on (source_chain_id, tx_hash, log_index) prevents replays.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "processed_message")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub source_chain_id: u64,
    pub tx_hash: Vec<u8>,
    pub log_index: u32,
    pub signature: Vec<u8>,
    pub processed_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
