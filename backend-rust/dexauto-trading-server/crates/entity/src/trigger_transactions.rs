use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Trigger transaction record for limit/conditional orders.
///
/// NOTE (Audit #26): `trigger_price_usd` uses f64 which is acceptable for trigger
/// thresholds (approximate comparison), but NOT for precise financial calculations.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "trigger_transactions")]
pub struct Model {
    #[sea_orm(primary_key)]
    #[serde(skip_serializing)]
    pub id: u64,
    pub order_id: String,
    pub user_id: String,
    pub trigger_price_usd: f64,
    pub input_mint: String,
    pub output_mint: String,
    pub amount: i64,
    pub swap_type: String,
    pub is_triggered: bool,
    pub trading_tx_id: Option<u64>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
