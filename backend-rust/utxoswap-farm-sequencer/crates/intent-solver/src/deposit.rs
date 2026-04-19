use anyhow::Result;

/// Solve deposit (stake LP tokens) intent
pub struct DepositSolver;

impl DepositSolver {
    /// Process a deposit intent — stake LP tokens into farm pool.
    ///
    /// `verified_user_staked` is the on-chain verified user staked amount
    /// (looked up from the pool's user-position cell), used to cross-check
    /// the `intent_user_staked` value submitted in the intent cell.
    /// This prevents a malicious user from falsifying their staked amount.
    pub fn solve(
        lp_amount: u128,
        pool_total_staked: u128,
        intent_user_staked: u128,
        verified_user_staked: Option<u128>,
    ) -> Result<DepositResult> {
        if lp_amount == 0 {
            anyhow::bail!("deposit amount must be > 0");
        }

        // Validate that the intent's user_staked matches the on-chain record
        if let Some(verified) = verified_user_staked {
            if intent_user_staked != verified {
                anyhow::bail!(
                    "user_staked mismatch: intent claims {} but on-chain is {}",
                    intent_user_staked,
                    verified
                );
            }
        }

        Ok(DepositResult {
            lp_amount,
            new_user_staked: intent_user_staked + lp_amount,
            new_pool_total: pool_total_staked + lp_amount,
        })
    }
}

pub struct DepositResult {
    pub lp_amount: u128,
    pub new_user_staked: u128,
    pub new_pool_total: u128,
}
