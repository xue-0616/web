use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Token类型枚举
/// @values 0=Native(CKB), 1=xUDT, 2=SUDT, 3=Inscription
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum TokenType {
    #[sea_orm(num_value = 0)]
    Native,
    #[sea_orm(num_value = 1)]
    XUDT,
    #[sea_orm(num_value = 2)]
    SUDT,
    #[sea_orm(num_value = 3)]
    Inscription,
}

/// Script hash type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum HashType {
    #[sea_orm(num_value = 0)]
    Data,
    #[sea_orm(num_value = 1)]
    Type,
    #[sea_orm(num_value = 2)]
    Data1,
    #[sea_orm(num_value = 3)]
    Data2,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tokens")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    /// Token logo URL
    #[sea_orm(column_type = "String(Some(1024))", nullable)]
    pub logo: Option<String>,
    /// Token symbol, e.g. "CKB"
    #[sea_orm(column_type = "String(Some(32))")]
    pub symbol: String,
    /// Token name
    #[sea_orm(column_type = "String(Some(256))")]
    pub name: String,
    /// Token decimals
    pub decimals: u8,
    /// Token type hash (blake2b of type script)
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))", unique)]
    pub type_hash: Vec<u8>,
    /// Type script code hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub type_code_hash: Vec<u8>,
    /// Type script args
    #[sea_orm(column_type = "VarBinary(64)")]
    pub type_args: Vec<u8>,
    /// Type script hash type
    pub type_hash_type: HashType,
    /// Token type
    #[sea_orm(column_name = "type")]
    pub token_type: TokenType,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
