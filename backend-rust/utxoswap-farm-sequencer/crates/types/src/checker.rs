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

/// Clock-skew tolerance applied when the caller uses wall-clock time
/// instead of a CKB block timestamp.
///
/// MED-FM-2: the sequencer's wall clock and the CKB block clock can
/// diverge by tens of seconds in practice and by minutes when an
/// NTP daemon restarts or a new block is delayed. Deciding
/// `PoolEnded` right at `now > pool.end_time` therefore produced
/// inconsistent verdicts — the same intent might pass the
/// sequencer's check and still fail the on-chain contract (or vice
/// versa), making every race between scheduled pool end and a
/// queued user intent a support ticket.
///
/// 120 seconds is two CKB epochs' worth of slack; well inside the
/// tolerance CKB contracts themselves use for block-time
/// comparisons, and safely larger than typical NTP drift. The value
/// is a `const`, not an env var, on purpose — it should change in
/// lockstep with the on-chain contract's equivalent constant, not
/// per-deployment.
pub const CLOCK_SKEW_TOLERANCE_SECS: u64 = 120;

/// Read wall-clock seconds since the UNIX epoch without panicking
/// on clocks that run backwards. The `.duration_since` can return
/// `Err` only if the system clock is set before 1970-01-01, which
/// would happen on a freshly-booted device with a dead RTC battery.
/// Treating "time is broken" as `now = 0` makes every not-yet-
/// started pool look active and every ended pool look ended, which
/// is safe-ish for the use-case but also *observable*: the caller
/// can log a warning if the value is implausible.
pub fn now_secs_wallclock() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Check a farm intent against a pool snapshot.
///
/// `reference_time_secs` is caller-supplied. The sequencer should
/// pass the **latest observed CKB block timestamp** when one is
/// available and `now_secs_wallclock()` otherwise; in both cases
/// the comparison against `pool.end_time` uses
/// `CLOCK_SKEW_TOLERANCE_SECS` of slack so that an intent right at
/// the end of a pool receives the same verdict the on-chain
/// contract would give it.
///
/// Returning `Err(PoolEnded)` only fires once
/// `reference_time_secs > pool.end_time + CLOCK_SKEW_TOLERANCE_SECS`.
/// Harvests are similarly lenient — a user trying to collect in
/// the tail-end window around pool end will succeed as long as
/// `pool.last_reward_time` says there are rewards left to claim.
pub fn check_farm_intent(
    intent: &ParsedFarmIntent,
    pool: &FarmPoolState,
    reference_time_secs: u64,
) -> Result<(), CheckError> {
    if intent.amount == 0 && intent.intent_type != FarmIntentType::Harvest {
        return Err(CheckError::ZeroAmount);
    }

    // Treat the pool as ended only once we're *confidently* past
    // `pool.end_time`. The `saturating_add` protects against a
    // configured `u64::MAX` end_time overflowing the comparison.
    let ended = reference_time_secs
        > pool.end_time.saturating_add(CLOCK_SKEW_TOLERANCE_SECS);

    match intent.intent_type {
        FarmIntentType::Deposit => {
            if ended {
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
            if ended && pool.last_reward_time >= pool.end_time {
                return Err(CheckError::NoRewardsAvailable);
            }
            Ok(())
        }
        FarmIntentType::WithdrawAndHarvest => {
            if intent.amount > intent.user_staked_amount {
                return Err(CheckError::InsufficientStaked);
            }
            // Even if the pool is ended with no rewards left, allow
            // the withdraw leg; the solver will zero out the reward
            // portion. We intentionally do NOT return `PoolEnded`
            // here.
            Ok(())
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    //! MED-FM-2 regression tests. The old signature took no
    //! timestamp argument and used `SystemTime::now()` directly,
    //! so "does an intent submitted right at pool end pass?" was
    //! literally a function of when `cargo test` ran. These
    //! deterministic tests pin the tolerance window and its three
    //! boundary conditions.
    use super::*;
    use crate::{FarmIntentType, FarmPoolState, ParsedFarmIntent};

    fn mk_pool(end_time: u64, last_reward_time: u64) -> FarmPoolState {
        FarmPoolState {
            farm_type_hash: [0u8; 32],
            pool_type_hash: [0u8; 32],
            reward_token_type_hash: [0u8; 32],
            lp_token_type_hash: [0u8; 32],
            total_staked: 1000,
            reward_per_second: 1,
            acc_reward_per_share: 0,
            last_reward_time,
            start_time: 0,
            end_time,
        }
    }

    fn mk_deposit() -> ParsedFarmIntent {
        ParsedFarmIntent {
            intent_type: FarmIntentType::Deposit,
            farm_type_hash: [1u8; 32],
            amount: 100,
            lock_hash: [2u8; 32],
            user_staked_amount: 0,
            user_reward_debt: 0,
        }
    }

    #[test]
    fn deposit_at_exact_end_time_is_accepted() {
        let pool = mk_pool(1_000, 500);
        // reference == end_time is inside the tolerance window
        assert!(check_farm_intent(&mk_deposit(), &pool, 1_000).is_ok());
    }

    #[test]
    fn deposit_within_tolerance_of_end_is_accepted() {
        let pool = mk_pool(1_000, 500);
        let inside = 1_000 + CLOCK_SKEW_TOLERANCE_SECS;
        // Exactly at the tolerance boundary: still accepted (>,
        // not >=).
        assert!(
            check_farm_intent(&mk_deposit(), &pool, inside).is_ok(),
            "a deposit {}s past end_time should still be accepted under the \
             clock-skew tolerance",
            CLOCK_SKEW_TOLERANCE_SECS
        );
    }

    #[test]
    fn deposit_past_tolerance_is_rejected_as_ended() {
        let pool = mk_pool(1_000, 500);
        let outside = 1_000 + CLOCK_SKEW_TOLERANCE_SECS + 1;
        let err = check_farm_intent(&mk_deposit(), &pool, outside).unwrap_err();
        assert!(matches!(err, CheckError::PoolEnded),
            "expected PoolEnded past the tolerance, got {:?}", err);
    }

    #[test]
    fn harvest_in_tail_window_succeeds_when_rewards_remain() {
        let pool = mk_pool(1_000, 800);
        let harvest = ParsedFarmIntent {
            intent_type: FarmIntentType::Harvest,
            farm_type_hash: [1u8; 32],
            amount: 0,
            lock_hash: [2u8; 32],
            user_staked_amount: 0,
            user_reward_debt: 0,
        };
        // Way past end, but last_reward_time=800 < end_time=1000
        // -> there are still rewards to claim.
        assert!(check_farm_intent(&harvest, &pool, 999_999).is_ok());
    }

    #[test]
    fn harvest_past_tolerance_with_no_rewards_is_rejected() {
        // Same setup but last_reward_time caught up to end_time.
        let pool = mk_pool(1_000, 1_000);
        let harvest = ParsedFarmIntent {
            intent_type: FarmIntentType::Harvest,
            farm_type_hash: [1u8; 32],
            amount: 0,
            lock_hash: [2u8; 32],
            user_staked_amount: 0,
            user_reward_debt: 0,
        };
        let outside = 1_000 + CLOCK_SKEW_TOLERANCE_SECS + 1;
        assert!(matches!(
            check_farm_intent(&harvest, &pool, outside),
            Err(CheckError::NoRewardsAvailable)
        ));
    }

    #[test]
    fn tolerance_saturating_add_does_not_overflow() {
        // pool.end_time = u64::MAX exercises the saturating_add
        // guard in `check_farm_intent`; without it, the comparison
        // would wrap and every intent would look "ended".
        let pool = mk_pool(u64::MAX, 0);
        assert!(check_farm_intent(&mk_deposit(), &pool, u64::MAX).is_ok());
    }

    #[test]
    fn wallclock_helper_never_panics() {
        // Just a smoke test: the replacement for `.unwrap()` must
        // return *something* regardless of clock state.
        let _ = now_secs_wallclock();
    }
}
