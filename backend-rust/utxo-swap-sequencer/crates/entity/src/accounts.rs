use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "accounts")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    /// CKB lock script hash (blake2b-256)
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))", unique)]
    pub lock_hash: Vec<u8>,
    /// Wallet types, comma-separated (e.g. "JoyID,UniPass")
    #[sea_orm(column_type = "String(Some(1024))")]
    pub wallet_types: String,
    /// Total accumulated points
    #[sea_orm(default_value = "0")]
    pub total_points: u64,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
