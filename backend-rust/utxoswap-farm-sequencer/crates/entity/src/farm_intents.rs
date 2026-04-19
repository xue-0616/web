use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum FarmIntentType {
    #[sea_orm(num_value = 0)] Deposit,
    #[sea_orm(num_value = 1)] Withdraw,
    #[sea_orm(num_value = 2)] Harvest,
    #[sea_orm(num_value = 3)] WithdrawAndHarvest,
    #[sea_orm(num_value = 4)] CreatePool,
    #[sea_orm(num_value = 5)] Fund,
    #[sea_orm(num_value = 6)] AdminSetEndTime,
    #[sea_orm(num_value = 7)] AdminSetUdtPerSecond,
    #[sea_orm(num_value = 8)] AdminRefund,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum FarmIntentStatus {
    #[sea_orm(num_value = 0)] Pending,
    #[sea_orm(num_value = 1)] Processing,
    #[sea_orm(num_value = 2)] Completed,
    #[sea_orm(num_value = 3)] Failed,
    #[sea_orm(num_value = 4)] Refunded,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "farm_intents")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub intent_type: FarmIntentType,
    pub farm_type_hash: Vec<u8>,
    pub cell_tx_hash: Vec<u8>,
    pub cell_index: u32,
    pub lock_hash: Vec<u8>,
    pub amount: rust_decimal::Decimal,        // LP amount for deposit/withdraw, reward for harvest
    pub reward_amount: Option<rust_decimal::Decimal>,
    pub batch_tx_hash: Option<Vec<u8>>,
    pub error_reason: Option<Json>,
    pub status: FarmIntentStatus,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
