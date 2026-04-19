pub mod common;
pub mod deposit;
pub mod harvest;
pub mod tx;
pub mod withdraw;
pub mod withdraw_and_harvest;

use types::{FarmPoolState, ParsedFarmIntent, FarmIntentType};

/// Result of solving a batch of farm intents
#[derive(Debug)]
pub struct FarmSolverResult {
    pub deposit_events: Vec<types::DepositEvent>,
    pub withdraw_events: Vec<types::WithdrawEvent>,
    pub harvest_events: Vec<types::HarvestEvent>,
    pub refunded: Vec<(u64, String)>,
    pub new_pool_state: FarmPoolState,
}

/// Calculate pending reward for a user position
/// pending = user_staked * acc_reward_per_share / PRECISION_FACTOR - user_reward_debt
pub fn pending_reward(
    user_staked: u128,
    acc_reward_per_share: u128,
    user_reward_debt: u128,
) -> u128 {
    let reward = user_staked * acc_reward_per_share / common::PRECISION_FACTOR;
    reward.saturating_sub(user_reward_debt)
}

/// Update pool's acc_reward_per_share to current time.
/// Caps reward accrual at pool.end_time to prevent infinite inflation.
pub fn update_pool(pool: &mut FarmPoolState, current_time: u64) {
    if current_time <= pool.last_reward_time || pool.total_staked == 0 {
        pool.last_reward_time = current_time;
        return;
    }

    let end = std::cmp::min(current_time, pool.end_time);
    if end <= pool.last_reward_time {
        return;
    }

    let duration = (end - pool.last_reward_time) as u128;
    let reward = duration * pool.reward_per_second;
    pool.acc_reward_per_share += reward * common::PRECISION_FACTOR / pool.total_staked;
    pool.last_reward_time = end;
}

/// Solve a batch of farm intents
pub fn solve_batch(
    intents: &[(u64, ParsedFarmIntent)],
    pool: &FarmPoolState,
    current_time: u64,
) -> FarmSolverResult {
    let mut state = pool.clone();
    update_pool(&mut state, current_time);

    let mut result = FarmSolverResult {
        deposit_events: Vec::new(),
        withdraw_events: Vec::new(),
        harvest_events: Vec::new(),
        refunded: Vec::new(),
        new_pool_state: state.clone(),
    };

    for (id, intent) in intents {
        match intent.intent_type {
            FarmIntentType::Deposit => {
                let pending = pending_reward(
                    intent.user_staked_amount,
                    state.acc_reward_per_share,
                    intent.user_reward_debt,
                );
                state.total_staked += intent.amount;
                result.deposit_events.push(types::DepositEvent {
                    intent_id: *id,
                    farm_type_hash: intent.farm_type_hash,
                    lp_amount: intent.amount,
                    pending_reward: pending,
                });
            }
            FarmIntentType::Withdraw => {
                if intent.amount > intent.user_staked_amount {
                    result.refunded.push((*id, "Insufficient staked".to_string()));
                    continue;
                }
                let pending = pending_reward(
                    intent.user_staked_amount,
                    state.acc_reward_per_share,
                    intent.user_reward_debt,
                );
                state.total_staked = state.total_staked.saturating_sub(intent.amount);
                result.withdraw_events.push(types::WithdrawEvent {
                    intent_id: *id,
                    farm_type_hash: intent.farm_type_hash,
                    lp_amount: intent.amount,
                    pending_reward: pending,
                });
            }
            FarmIntentType::Harvest => {
                let pending = pending_reward(
                    intent.user_staked_amount,
                    state.acc_reward_per_share,
                    intent.user_reward_debt,
                );
                result.harvest_events.push(types::HarvestEvent {
                    intent_id: *id,
                    farm_type_hash: intent.farm_type_hash,
                    reward_amount: pending,
                });
            }
            FarmIntentType::WithdrawAndHarvest => {
                if intent.amount > intent.user_staked_amount {
                    result.refunded.push((*id, "Insufficient staked".to_string()));
                    continue;
                }
                let pending = pending_reward(
                    intent.user_staked_amount,
                    state.acc_reward_per_share,
                    intent.user_reward_debt,
                );
                state.total_staked = state.total_staked.saturating_sub(intent.amount);
                result.withdraw_events.push(types::WithdrawEvent {
                    intent_id: *id,
                    farm_type_hash: intent.farm_type_hash,
                    lp_amount: intent.amount,
                    pending_reward: pending,
                });
            }
            _ => {
                // CreatePool, Fund, Admin operations — handled separately
            }
        }
    }

    result.new_pool_state = state;
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pending_reward() {
        assert_eq!(pending_reward(1000, 1_000_000_000_000, 0), 1000);
        assert_eq!(pending_reward(1000, 2_000_000_000_000, 500), 1500);
    }

    #[test]
    fn test_update_pool() {
        let mut pool = FarmPoolState {
            farm_type_hash: [0; 32],
            pool_type_hash: [0; 32],
            reward_token_type_hash: [0; 32],
            lp_token_type_hash: [0; 32],
            total_staked: 1000,
            reward_per_second: 10,
            acc_reward_per_share: 0,
            last_reward_time: 100,
            start_time: 0,
            end_time: 10000,
        };
        update_pool(&mut pool, 200);
        // 100 seconds * 10 reward/sec * 1e12 / 1000 staked
        assert_eq!(pool.acc_reward_per_share, 1_000_000_000_000);
    }
}
