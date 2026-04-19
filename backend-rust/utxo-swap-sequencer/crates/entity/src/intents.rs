use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Intent类型
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum IntentType {
    #[sea_orm(num_value = 0)]
    SwapExactInputForOutput,
    #[sea_orm(num_value = 1)]
    SwapInputForExactOutput,
    #[sea_orm(num_value = 2)]
    AddLiquidity,
    #[sea_orm(num_value = 3)]
    RemoveLiquidity,
}

/// Swap方向
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum SwapType {
    #[sea_orm(num_value = 0)]
    XToY,
    #[sea_orm(num_value = 1)]
    YToX,
}

/// Intent状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum IntentStatus {
    #[sea_orm(num_value = 0)]
    Pending,
    #[sea_orm(num_value = 1)]
    Processing,
    #[sea_orm(num_value = 2)]
    Completed,
    #[sea_orm(num_value = 3)]
    Failed,
    #[sea_orm(num_value = 4)]
    Refunded,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "intents")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    /// Intent type (swap/add_liq/remove_liq)
    pub intent_type: IntentType,
    /// CKB cell index
    pub cell_index: u32,
    /// CKB cell tx hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub cell_tx_hash: Vec<u8>,
    /// Pool type hash (identifies which pool)
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub pool_type_hash: Vec<u8>,
    /// Asset X type hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub asset_x_type_hash: Vec<u8>,
    /// Asset Y type hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub asset_y_type_hash: Vec<u8>,
    /// BL-C1: Actual type_script args for asset_x (from on-chain type_script)
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))", nullable)]
    pub asset_x_type_args: Option<Vec<u8>>,
    /// BL-C1: Actual type_script args for asset_y (from on-chain type_script)
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))", nullable)]
    pub asset_y_type_args: Option<Vec<u8>>,
    /// Swap direction
    #[sea_orm(nullable)]
    pub swap_type: Option<SwapType>,
    /// Input amount (raw)
    #[sea_orm(column_type = "Decimal(Some((40, 0)))")]
    pub amount_in: rust_decimal::Decimal,
    /// Output amount (raw)
    #[sea_orm(column_type = "Decimal(Some((40, 0)))")]
    pub amount_out: rust_decimal::Decimal,
    /// Minimum amount (slippage protection)
    #[sea_orm(column_type = "Decimal(Some((40, 0)))")]
    pub min_amount: rust_decimal::Decimal,
    /// User's CKB lock script hash (blake160)
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub lock_hash: Vec<u8>,
    /// Lock script code hash
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))")]
    pub lock_code_hash: Vec<u8>,
    /// Lock script args
    #[sea_orm(column_type = "VarBinary(64)")]
    pub lock_args: Vec<u8>,
    /// Asset X input cell index
    #[sea_orm(nullable)]
    pub asset_x_in_index: Option<u32>,
    /// Pool tx hash (set after batch processing)
    #[sea_orm(column_type = "Binary(BlobSize::Blob(None))", nullable)]
    pub pool_tx_hash: Option<Vec<u8>>,
    /// Error reason (JSON)
    #[sea_orm(column_type = "Json", nullable)]
    pub error_reason: Option<serde_json::Value>,
    /// Intent status
    pub status: IntentStatus,
    /// API key (for external integrations like UTXO Global)
    #[sea_orm(column_type = "String(Some(40))", nullable)]
    pub api_key: Option<String>,
    /// Wallet type (JoyID, UniPass, etc.)
    #[sea_orm(column_type = "String(Some(20))", nullable)]
    pub wallet_type: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
