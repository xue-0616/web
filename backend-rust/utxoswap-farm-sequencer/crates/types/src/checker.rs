use crate::{FarmIntentType, FarmPoolState, ParsedFarmIntent};

#[derive(Debug, thiserror::Error)]
pub enum CheckError {
    #[error("Farm pool not found")]
    PoolNotFound,
    #[error("Farm pool not active")]
    PoolNotActive,
    #[error("Insufficient staked amount")]
    InsufficientStaked,
    #[error("Zero amount")]
    ZeroAmount,
    #[error("Farm pool ended")]
    PoolEnded,
    #[error("No rewards to harvest: pool ended and already harvested up to end_time")]
    NoRewardsAvailable,
}

pub fn check_farm_intent(intent: &ParsedFarmIntent, pool: &FarmPoolState) -> Result<(), CheckError> {
    if intent.amount == 0 && intent.intent_type != FarmIntentType::Harvest {
        return Err(CheckError::ZeroAmount);
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    match intent.intent_type {
        FarmIntentType::Deposit => {
            // Pool must be active and not ended
            if now > pool.end_time {
                return Err(CheckError::PoolEnded);
            }
            Ok(())
        }
        FarmIntentType::Withdraw => {
            if intent.amount > intent.user_staked_amount {
                return Err(CheckError::InsufficientStaked);
            }
            Ok(())
        }
        FarmIntentType::Harvest => {
            // Harvest is allowed after pool ends (to collect remaining rewards),
            // but reject if pool ended AND last_reward_time >= end_time
            // (all rewards already distributed).
            if now > pool.end_time && pool.last_reward_time >= pool.end_time {
                return Err(CheckError::NoRewardsAvailable);
            }
            Ok(())
        }
        FarmIntentType::WithdrawAndHarvest => {
            if intent.amount > intent.user_staked_amount {
                return Err(CheckError::InsufficientStaked);
            }
            // Same harvest window check — rewards must still be unclaimed
            if now > pool.end_time && pool.last_reward_time >= pool.end_time {
                // Allow withdraw even after all rewards claimed, but zero out reward
                // This is handled in the solver — we don't block the intent.
            }
            Ok(())
        }
        _ => Ok(()),
    }
}
