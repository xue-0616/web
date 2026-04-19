use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

use crate::tokens::HashType;

/// Based asset indicator
/// @values 0=asset_x, 1=asset_y
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum BasedAsset {
    #[sea_orm(num_value = 0)]
    AssetX,
    #[sea_orm(num_value = 1)]
    AssetY,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "pools")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    /// Pairs creator script hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub creator: Vec<u8>,
    /// Asset X type hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub asset_x_type_hash: Vec<u8>,
    /// Asset Y type hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub asset_y_type_hash: Vec<u8>,
    /// Pair cell type script hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))", unique)]
    pub type_hash: Vec<u8>,
    /// Pair type script code hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub type_code_hash: Vec<u8>,
    /// Type script hash type
    pub type_hash_type: HashType,
    /// Pair cell type script args
    #[sea_orm(column_type = "VarBinary(64)")]
    pub type_args: Vec<u8>,
    /// LP token symbol
    #[sea_orm(column_type = "String(Some(32))")]
    pub lp_symbol: String,
    /// LP token name
    #[sea_orm(column_type = "String(Some(256))")]
    pub lp_name: String,
    /// LP token decimals
    pub lp_decimals: u8,
    /// Total Value Locked (USD)
    #[sea_orm(column_type = "Decimal(Some((50, 9)))", nullable)]
    pub tvl: Option<Decimal>,
    /// Swap tx count in a day
    #[sea_orm(nullable)]
    pub day_txs_count: Option<u64>,
    /// Total swap tx count
    #[sea_orm(nullable)]
    pub total_txs_count: Option<u64>,
    /// Day volume (USD)
    #[sea_orm(column_type = "Decimal(Some((50, 9)))", nullable)]
    pub day_volume: Option<Decimal>,
    /// Asset X amount (raw)
    #[sea_orm(column_type = "Decimal(Some((40, 0)))", nullable)]
    pub asset_x_amount: Option<Decimal>,
    /// Asset Y amount (raw)
    #[sea_orm(column_type = "Decimal(Some((40, 0)))", nullable)]
    pub asset_y_amount: Option<Decimal>,
    /// Which asset is the base (for price display)
    #[sea_orm(nullable)]
    pub based_asset: Option<BasedAsset>,
    /// Based asset price (USD per token)
    #[sea_orm(column_type = "Decimal(Some((50, 9)))", nullable)]
    pub based_asset_price: Option<Decimal>,
    /// Based asset decimals
    #[sea_orm(nullable)]
    pub based_asset_decimals: Option<u8>,
    /// Total volume (USD)
    #[sea_orm(column_type = "Decimal(Some((50, 9)))", nullable)]
    pub total_volume: Option<Decimal>,
    /// Day APR
    #[sea_orm(column_type = "Decimal(Some((50, 9)))", nullable)]
    pub day_apr: Option<Decimal>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
