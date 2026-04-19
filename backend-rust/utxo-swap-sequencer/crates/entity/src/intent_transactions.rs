use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Intent transaction status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum IntentTxStatus {
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
#[sea_orm(table_name = "intent_transactions")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    /// Related intent ID
    pub intent_id: u64,
    /// CKB transaction hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub tx_hash: Vec<u8>,
    /// Transaction status
    pub status: IntentTxStatus,
    /// Error message if failed
    #[sea_orm(column_type = "String(Some(1024))", nullable)]
    pub error_msg: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
