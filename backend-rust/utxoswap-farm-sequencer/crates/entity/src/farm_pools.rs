use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum FarmPoolStatus {
    #[sea_orm(num_value = 0)] Pending,
    #[sea_orm(num_value = 1)] Active,
    #[sea_orm(num_value = 2)] Ended,
    #[sea_orm(num_value = 3)] Cancelled,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "farm_pools")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub pool_type_hash: Vec<u8>,         // UTXOSwap pool type hash
    pub reward_token_type_hash: Vec<u8>, // reward token type hash
    pub lp_token_type_hash: Vec<u8>,     // LP token type hash
    pub farm_type_hash: Vec<u8>,         // farm cell type hash
    pub creator: Vec<u8>,                // creator lock hash
    pub total_staked: rust_decimal::Decimal,
    pub reward_per_second: rust_decimal::Decimal,
    pub acc_reward_per_share: rust_decimal::Decimal,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub last_reward_time: chrono::NaiveDateTime,
    pub status: FarmPoolStatus,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
