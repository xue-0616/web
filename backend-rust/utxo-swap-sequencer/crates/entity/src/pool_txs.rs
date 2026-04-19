use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Pool transaction status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum PoolTxStatus {
    #[sea_orm(num_value = 0)]
    Pending,
    #[sea_orm(num_value = 1)]
    Submitted,
    #[sea_orm(num_value = 2)]
    Confirmed,
    #[sea_orm(num_value = 3)]
    Failed,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "pool_txs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    /// Pool type hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub pool_type_hash: Vec<u8>,
    /// CKB transaction hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub tx_hash: Vec<u8>,
    /// Serialized CKB transaction binary
    #[sea_orm(column_type = "Binary(BlobSize::Medium)")]
    pub tx: Vec<u8>,
    /// Batch ID
    pub batch_id: u64,
    /// Block number when confirmed
    #[sea_orm(nullable)]
    pub block_number: Option<u64>,
    /// Comma-separated intent IDs
    #[sea_orm(column_type = "String(Some(10240))")]
    pub intent_ids: String,
    /// Refunded intent IDs (JSON array)
    #[sea_orm(column_type = "Json", nullable)]
    pub refunded_intent_ids: Option<serde_json::Value>,
    /// Intent events (JSON — swap/mint/burn events)
    #[sea_orm(column_type = "Json", nullable)]
    pub intent_events: Option<serde_json::Value>,
    /// Error reason if failed
    #[sea_orm(column_type = "String(Some(1024))", nullable)]
    pub error_reason: Option<String>,
    /// Transaction status
    pub status: PoolTxStatus,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
