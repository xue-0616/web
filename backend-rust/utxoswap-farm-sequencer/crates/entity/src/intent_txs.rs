use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum IntentTxStatus {
    #[sea_orm(num_value = 0)] Pending,
    #[sea_orm(num_value = 1)] Submitted,
    #[sea_orm(num_value = 2)] Confirmed,
    #[sea_orm(num_value = 3)] Failed,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "intent_txs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub intent_id: u64,
    pub tx_hash: Vec<u8>,
    pub status: IntentTxStatus,
    pub error_msg: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
