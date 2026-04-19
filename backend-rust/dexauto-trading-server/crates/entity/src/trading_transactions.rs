use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum TxStatus {
    #[sea_orm(num_value = 0)] Pending,
    #[sea_orm(num_value = 1)] Submitted,
    #[sea_orm(num_value = 2)] Confirmed,
    #[sea_orm(num_value = 3)] Failed,
    #[sea_orm(num_value = 4)] Cancelled,
}

/// Trading transaction record.
///
/// SAFETY (Audit #21): Several fields use signed types (i64/i16) because most SQL databases
/// and SeaORM default to signed integers. The API layer enforces that values are non-negative
/// and within i64::MAX via `validate_swap_request()` before insertion, preventing overflow.
/// `order_id` uniqueness is enforced at the application layer in the swap handler (Audit #22).
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "trading_transactions")]
pub struct Model {
    #[sea_orm(primary_key)]
    #[serde(skip_serializing)]
    pub id: u64,
    #[sea_orm(unique)]
    pub order_id: String,
    pub user_id: String,
    pub trading_account_pda: String,
    pub input_mint: String,
    pub output_mint: String,
    /// Stored as i64; API layer validates 0 < value ≤ i64::MAX before insert.
    pub amount_specified: i64,
    /// Stored as i64; API layer validates value ≤ i64::MAX before insert.
    pub other_amount_threshold: i64,
    pub slippage_bps: i16,
    pub base_in: bool,
    pub fee_rate_bps: i16,
    /// Stored as i64; API layer validates 0 ≤ value ≤ i64::MAX before insert.
    pub max_priority_fee: i64,
    pub is_anti_mev: bool,
    /// Stored as i64; API layer validates 0 ≤ value ≤ i64::MAX before insert.
    pub bribery_amount: i64,
    pub swap_type: String,           // ExactIn | ExactOut
    pub trigger_price_usd: Option<f64>,
    pub tx_signature: Option<String>,
    pub pool_id: Option<String>,
    pub error_msg: Option<String>,
    pub status: TxStatus,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
