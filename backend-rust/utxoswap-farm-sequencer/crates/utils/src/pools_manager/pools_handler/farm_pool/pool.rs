use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FarmPoolState {
    pub pool_id: String,
    pub lp_type_hash: [u8; 32],
    pub reward_type_hash: [u8; 32],
    pub total_staked: u128,
    pub udt_per_second: u128,
    pub start_time: u64,
    pub end_time: u64,
    pub last_reward_time: u64,
    pub acc_reward_per_share: u128,
}
