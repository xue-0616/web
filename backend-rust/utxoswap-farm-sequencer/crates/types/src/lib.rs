pub mod checker;
pub mod parser;
pub mod utils;

use serde::{Deserialize, Serialize};

/// Farm pool on-chain state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FarmPoolState {
    pub farm_type_hash: [u8; 32],
    pub pool_type_hash: [u8; 32],
    pub reward_token_type_hash: [u8; 32],
    pub lp_token_type_hash: [u8; 32],
    pub total_staked: u128,
    pub reward_per_second: u128,
    pub acc_reward_per_share: u128,
    pub last_reward_time: u64,
    pub start_time: u64,
    pub end_time: u64,
}

/// Parsed farm intent from CKB cell data
#[derive(Debug, Clone)]
pub struct ParsedFarmIntent {
    pub intent_type: FarmIntentType,
    pub farm_type_hash: [u8; 32],
    pub amount: u128,
    pub lock_hash: [u8; 32],
    pub user_staked_amount: u128,
    pub user_reward_debt: u128,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FarmIntentType {
    Deposit,
    Withdraw,
    Harvest,
    WithdrawAndHarvest,
    CreatePool,
    Fund,
    AdminSetEndTime,
    AdminSetUdtPerSecond,
    AdminRefund,
}

/// Farm events emitted after processing
#[derive(Debug, Clone, Serialize)]
pub struct DepositEvent {
    pub intent_id: u64,
    pub farm_type_hash: [u8; 32],
    pub lp_amount: u128,
    pub pending_reward: u128,
}

#[derive(Debug, Clone, Serialize)]
pub struct WithdrawEvent {
    pub intent_id: u64,
    pub farm_type_hash: [u8; 32],
    pub lp_amount: u128,
    pub pending_reward: u128,
}

#[derive(Debug, Clone, Serialize)]
pub struct HarvestEvent {
    pub intent_id: u64,
    pub farm_type_hash: [u8; 32],
    pub reward_amount: u128,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateEvent {
    pub farm_type_hash: [u8; 32],
    pub pool_type_hash: [u8; 32],
    pub reward_per_second: u128,
    pub start_time: u64,
    pub end_time: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FundEvent {
    pub farm_type_hash: [u8; 32],
    pub amount: u128,
}
