use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

use crate::tokens::HashType;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "scripts")]
pub struct Model {
    /// Script hash (blake160, 20 bytes) — primary key
    #[sea_orm(primary_key, auto_increment = false, column_type = "Binary(BlobSize::Blob(None))")]
    pub script_hash: Vec<u8>,
    /// Code hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub code_hash: Vec<u8>,
    /// Hash type (data/type/data1/data2)
    pub hash_type: HashType,
    /// Script args
    #[sea_orm(column_type = "VarBinary(64)")]
    pub args: Vec<u8>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
