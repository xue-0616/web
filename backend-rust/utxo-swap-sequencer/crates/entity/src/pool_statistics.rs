use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Pool statistics for candlestick / time-series data
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "pool_statistics")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    /// Pool type hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub pool_type_hash: Vec<u8>,
    /// Asset X amount snapshot
    #[sea_orm(column_type = "Decimal(Some((40, 0)))", nullable)]
    pub asset_x_amount: Option<Decimal>,
    /// Asset Y amount snapshot
    #[sea_orm(column_type = "Decimal(Some((40, 0)))", nullable)]
    pub asset_y_amount: Option<Decimal>,
    /// Price snapshot
    #[sea_orm(column_type = "Decimal(Some((50, 9)))", nullable)]
    pub price: Option<Decimal>,
    /// TVL snapshot (USD)
    #[sea_orm(column_type = "Decimal(Some((50, 9)))", nullable)]
    pub tvl: Option<Decimal>,
    /// Volume in this period
    #[sea_orm(column_type = "Decimal(Some((50, 9)))", nullable)]
    pub volume: Option<Decimal>,
    /// Transaction count in this period
    #[sea_orm(nullable)]
    pub txs_count: Option<u64>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
