use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum BatchTxStatus {
    #[sea_orm(num_value = 0)] Pending,
    #[sea_orm(num_value = 1)] Submitted,
    #[sea_orm(num_value = 2)] Confirmed,
    #[sea_orm(num_value = 3)] Failed,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "batch_txs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub farm_type_hash: Vec<u8>,
    pub tx_hash: Vec<u8>,
    pub tx: Vec<u8>,
    pub batch_id: u64,
    pub block_number: Option<u64>,
    pub intent_ids: String,
    pub refunded_intent_ids: Option<Json>,
    pub intent_events: Option<Json>,
    pub error_reason: Option<String>,
    pub status: BatchTxStatus,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
