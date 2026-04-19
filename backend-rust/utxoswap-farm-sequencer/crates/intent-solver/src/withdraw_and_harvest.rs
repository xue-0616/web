use anyhow::Result;

/// Combined withdraw + harvest in single intent
pub struct WithdrawAndHarvestSolver;

impl WithdrawAndHarvestSolver {
    /// Solve a combined withdraw+harvest intent.
    ///
    /// `pool_end_time` caps reward accrual at the pool's end, preventing
    /// infinite reward inflation.
    ///
    /// `running_total_staked` should be the *current* accumulated total after
    /// processing prior intents in the same batch (not the pre-batch snapshot),
    /// to prevent reward over-payment when multiple users withdraw in the same
    /// batch.
    pub fn solve(
        lp_amount: u128,
        user_staked: u128,
        running_total_staked: u128,
        udt_per_second: u128,
        last_harvest_time: u64,
        current_time: u64,
        pool_end_time: u64,
    ) -> Result<WithdrawAndHarvestResult> {
        if lp_amount > user_staked {
            anyhow::bail!("insufficient staked balance");
        }

        // Cap current_time at pool_end_time
        let effective_time = std::cmp::min(current_time, pool_end_time);
        let elapsed = effective_time.saturating_sub(last_harvest_time);

        let reward = super::common::calculate_reward(
            udt_per_second,
            user_staked,
            running_total_staked,
            elapsed,
            Some(pool_end_time),
            Some(last_harvest_time),
        );

        Ok(WithdrawAndHarvestResult {
            lp_amount,
            reward_amount: reward,
            new_user_staked: user_staked - lp_amount,
            new_pool_total: running_total_staked.saturating_sub(lp_amount),
        })
    }
}

pub struct WithdrawAndHarvestResult {
    pub lp_amount: u128,
    pub reward_amount: u128,
    pub new_user_staked: u128,
    pub new_pool_total: u128,
}
