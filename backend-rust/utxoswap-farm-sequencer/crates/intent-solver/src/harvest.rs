use anyhow::Result;
use super::common;

/// Solve harvest (claim rewards) intent
pub struct HarvestSolver;

impl HarvestSolver {
    /// Solve a harvest intent.
    ///
    /// `pool_end_time` caps the reward accrual window so that rewards
    /// do not accumulate past the pool's configured end_time.
    pub fn solve(
        udt_per_second: u128,
        user_staked: u128,
        total_staked: u128,
        last_harvest_time: u64,
        current_time: u64,
        pool_end_time: u64,
    ) -> Result<HarvestResult> {
        // Cap current_time at pool_end_time to prevent infinite reward inflation
        let effective_time = std::cmp::min(current_time, pool_end_time);
        let elapsed = effective_time.saturating_sub(last_harvest_time);

        let reward = common::calculate_reward(
            udt_per_second,
            user_staked,
            total_staked,
            elapsed,
            Some(pool_end_time),
            Some(last_harvest_time),
        );
        Ok(HarvestResult { reward_amount: reward })
    }
}

pub struct HarvestResult {
    pub reward_amount: u128,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_harvest_capped_at_end_time() {
        // Pool ended at t=200, user harvests at t=300, last harvest at t=100
        let result = HarvestSolver::solve(10, 1000, 1000, 100, 300, 200).unwrap();
        // effective_time = min(300, 200) = 200, elapsed = 100
        // reward = 10 * 100 * 1e12 / 1000 * 1000 / 1e12 = 1000
        assert_eq!(result.reward_amount, 1000);
    }

    #[test]
    fn test_harvest_before_end_time() {
        // Pool ends at t=500, user harvests at t=200, last harvest at t=100
        let result = HarvestSolver::solve(10, 1000, 1000, 100, 200, 500).unwrap();
        // effective_time = min(200, 500) = 200, elapsed = 100
        assert_eq!(result.reward_amount, 1000);
    }
}
