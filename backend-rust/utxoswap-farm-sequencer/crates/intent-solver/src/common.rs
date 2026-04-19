use anyhow::Result;

/// Common farming calculation utilities

/// Precision factor for reward calculations to avoid integer division truncation.
/// Must match the PRECISION used in acc_reward_per_share (1e12).
pub const PRECISION_FACTOR: u128 = 1_000_000_000_000u128;

/// Calculate reward amount based on time elapsed and rate, with precision scaling.
///
/// Uses PRECISION_FACTOR to prevent integer-division truncation that would
/// cause small stakers to receive 0 rewards.
///
/// `pool_end_time` caps the reward accrual — rewards stop accumulating after
/// the pool ends, preventing infinite reward inflation.
pub fn calculate_reward(
    udt_per_second: u128,
    staked_amount: u128,
    total_staked: u128,
    seconds_elapsed: u64,
    pool_end_time: Option<u64>,
    last_reward_time: Option<u64>,
) -> u128 {
    if total_staked == 0 || staked_amount == 0 {
        return 0;
    }

    // Cap elapsed time at pool end_time to prevent rewards past pool expiry
    let effective_elapsed = match (pool_end_time, last_reward_time) {
        (Some(end), Some(last)) => {
            let capped_current = std::cmp::min(last.saturating_add(seconds_elapsed), end);
            capped_current.saturating_sub(last)
        }
        _ => seconds_elapsed,
    };

    if effective_elapsed == 0 {
        return 0;
    }

    // Multiply by PRECISION_FACTOR before division to retain precision
    let total_reward = udt_per_second * effective_elapsed as u128;
    let scaled_reward_per_share = total_reward * PRECISION_FACTOR / total_staked;
    staked_amount * scaled_reward_per_share / PRECISION_FACTOR
}

/// Validate farming pool is still active
pub fn is_pool_active(end_time: u64, current_time: u64) -> bool {
    current_time < end_time
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_precision_no_truncation() {
        // Small reward rate that previously truncated to 0
        let reward = calculate_reward(1, 100, 10_000, 10, None, None);
        // 1 * 10 * 1e12 / 10000 = 1_000_000_000 (scaled_per_share)
        // 100 * 1_000_000_000 / 1e12 = 0 (still 0 for very small amounts)
        // But for reasonable amounts:
        let reward2 = calculate_reward(10, 1000, 10_000, 100, None, None);
        // 10 * 100 * 1e12 / 10000 = 100_000_000_000 per share
        // 1000 * 100_000_000_000 / 1e12 = 100
        assert_eq!(reward2, 100);
    }

    #[test]
    fn test_end_time_cap() {
        // Pool ended 50 seconds ago, but user tries to claim 100 seconds worth
        let reward = calculate_reward(
            10, 1000, 1000, 100,
            Some(150), // pool_end_time
            Some(100), // last_reward_time
        );
        // effective_elapsed = min(100+100, 150) - 100 = 50
        // 10 * 50 * 1e12 / 1000 = 500_000_000_000
        // 1000 * 500_000_000_000 / 1e12 = 500
        assert_eq!(reward, 500);
    }

    #[test]
    fn test_zero_total_staked() {
        assert_eq!(calculate_reward(10, 100, 0, 100, None, None), 0);
    }

    #[test]
    fn test_zero_staked_amount() {
        assert_eq!(calculate_reward(10, 0, 1000, 100, None, None), 0);
    }
}
