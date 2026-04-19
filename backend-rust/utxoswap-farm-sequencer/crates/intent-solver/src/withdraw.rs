use anyhow::Result;

/// Solve withdraw (unstake LP tokens) intent
pub struct WithdrawSolver;

impl WithdrawSolver {
    pub fn solve(
        lp_amount: u128,
        pool_total_staked: u128,
        user_staked: u128,
    ) -> Result<WithdrawResult> {
        if lp_amount > user_staked {
            anyhow::bail!("insufficient staked balance");
        }
        Ok(WithdrawResult {
            lp_amount,
            new_user_staked: user_staked - lp_amount,
            new_pool_total: pool_total_staked - lp_amount,
        })
    }
}

pub struct WithdrawResult {
    pub lp_amount: u128,
    pub new_user_staked: u128,
    pub new_pool_total: u128,
}
