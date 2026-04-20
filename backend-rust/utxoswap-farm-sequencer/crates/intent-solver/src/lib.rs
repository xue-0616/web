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

/// A user's running position, threaded through the batch.
///
/// CRIT-FM-2: the previous implementation read `user_staked_amount`
/// and `user_reward_debt` directly off every intent. Those two
/// fields come from the user's on-chain cell and describe the
/// user's state BEFORE the batch started; re-reading them for every
/// intent meant that two intents from the same user in the same
/// batch both saw the pre-batch snapshot. A deposit-then-harvest
/// from the same user would pay out `pending(old_staked, acc, old_debt)`
/// twice — once for the deposit's implicit claim and again for the
/// explicit harvest — because the deposit never updated the
/// harvest's view of the user's reward_debt.
///
/// `UserPosition` threads the running (staked, reward_debt) pair
/// through every intent in `solve_batch`, keyed on the user's
/// lock_hash. The first intent for a given lock_hash seeds the
/// entry from that intent's on-chain snapshot; subsequent intents
/// read and write the running values.
#[derive(Clone, Copy)]
struct UserPosition {
    staked: u128,
    reward_debt: u128,
}

impl UserPosition {
    fn new_debt(&self, acc_reward_per_share: u128) -> u128 {
        // MasterChef invariant: after any deposit / withdraw /
        // harvest settles a user's pending reward, their debt is
        // reset to their current stake × current accumulator so
        // the next pending calculation subtracts the exact amount
        // already paid out.
        self.staked
            .saturating_mul(acc_reward_per_share)
            / common::PRECISION_FACTOR
    }
}

/// Solve a batch of farm intents.
///
/// See `UserPosition` for the rationale behind the per-user running
/// state. The pool-level `state.total_staked` is also updated
/// in-loop so pool-level reward accrual during this batch is
/// consistent with each intent's order of execution.
pub fn solve_batch(
    intents: &[(u64, ParsedFarmIntent)],
    pool: &FarmPoolState,
    current_time: u64,
) -> FarmSolverResult {
    use std::collections::HashMap;

    let mut state = pool.clone();
    update_pool(&mut state, current_time);

    let mut positions: HashMap<[u8; 32], UserPosition> = HashMap::new();

    let mut result = FarmSolverResult {
        deposit_events: Vec::new(),
        withdraw_events: Vec::new(),
        harvest_events: Vec::new(),
        refunded: Vec::new(),
        new_pool_state: state.clone(),
    };

    for (id, intent) in intents {
        // Look up this user's running position. The first time
        // we see the user in this batch, seed from their on-chain
        // snapshot; every subsequent intent for them reads and
        // updates the cached values.
        let pos = positions.entry(intent.lock_hash).or_insert(UserPosition {
            staked: intent.user_staked_amount,
            reward_debt: intent.user_reward_debt,
        });

        match intent.intent_type {
            FarmIntentType::Deposit => {
                let pending = pending_reward(
                    pos.staked,
                    state.acc_reward_per_share,
                    pos.reward_debt,
                );
                pos.staked = pos.staked.saturating_add(intent.amount);
                pos.reward_debt = pos.new_debt(state.acc_reward_per_share);
                state.total_staked = state.total_staked.saturating_add(intent.amount);
                result.deposit_events.push(types::DepositEvent {
                    intent_id: *id,
                    farm_type_hash: intent.farm_type_hash,
                    lp_amount: intent.amount,
                    pending_reward: pending,
                });
            }
            FarmIntentType::Withdraw => {
                if intent.amount > pos.staked {
                    result.refunded.push((*id, "Insufficient staked".to_string()));
                    continue;
                }
                let pending = pending_reward(
                    pos.staked,
                    state.acc_reward_per_share,
                    pos.reward_debt,
                );
                pos.staked = pos.staked.saturating_sub(intent.amount);
                pos.reward_debt = pos.new_debt(state.acc_reward_per_share);
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
                    pos.staked,
                    state.acc_reward_per_share,
                    pos.reward_debt,
                );
                pos.reward_debt = pos.new_debt(state.acc_reward_per_share);
                result.harvest_events.push(types::HarvestEvent {
                    intent_id: *id,
                    farm_type_hash: intent.farm_type_hash,
                    reward_amount: pending,
                });
            }
            FarmIntentType::WithdrawAndHarvest => {
                if intent.amount > pos.staked {
                    result.refunded.push((*id, "Insufficient staked".to_string()));
                    continue;
                }
                let pending = pending_reward(
                    pos.staked,
                    state.acc_reward_per_share,
                    pos.reward_debt,
                );
                pos.staked = pos.staked.saturating_sub(intent.amount);
                pos.reward_debt = pos.new_debt(state.acc_reward_per_share);
                state.total_staked = state.total_staked.saturating_sub(intent.amount);
                // Emit a WithdrawEvent carrying the pending reward;
                // the reward-emitting CKB transaction uses the
                // pending_reward field exactly as for a Harvest.
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

    /// Build a minimal ParsedFarmIntent for the stake-state tests.
    /// Only the fields solve_batch reads are set to non-default.
    fn mk_intent(
        kind: FarmIntentType,
        lock: [u8; 32],
        amount: u128,
        user_staked: u128,
        user_debt: u128,
    ) -> ParsedFarmIntent {
        ParsedFarmIntent {
            intent_type: kind,
            farm_type_hash: [1u8; 32],
            amount,
            lock_hash: lock,
            user_staked_amount: user_staked,
            user_reward_debt: user_debt,
        }
    }

    fn mk_pool() -> FarmPoolState {
        FarmPoolState {
            farm_type_hash: [1u8; 32],
            pool_type_hash: [2u8; 32],
            reward_token_type_hash: [3u8; 32],
            lp_token_type_hash: [4u8; 32],
            total_staked: 1000,
            reward_per_second: 0,       // no time-based accrual in these tests
            acc_reward_per_share: 2 * common::PRECISION_FACTOR,
            last_reward_time: 100,
            start_time: 0,
            end_time: 10_000,
        }
    }

    /// CRIT-FM-2 regression: two deposits from the same user in one
    /// batch must NOT both claim the pre-batch pending reward. The
    /// first deposit settles it; the second sees a zeroed debt
    /// relative to the settled position.
    #[test]
    fn crit_fm_2_same_user_two_deposits_does_not_double_pay() {
        let pool = mk_pool();
        let user = [9u8; 32];

        // User has 1000 staked, debt 0. acc = 2e12/1e12 = 2.
        // Pre-batch pending = 1000 * 2 - 0 = 2000.
        let i1 = mk_intent(FarmIntentType::Deposit, user, 500, 1000, 0);
        let i2 = mk_intent(FarmIntentType::Deposit, user, 500, 1000, 0);

        let r = solve_batch(&[(1, i1), (2, i2)], &pool, 100);

        assert_eq!(r.deposit_events.len(), 2);
        assert_eq!(
            r.deposit_events[0].pending_reward, 2000,
            "first deposit claims the full pre-batch pending"
        );
        assert_eq!(
            r.deposit_events[1].pending_reward, 0,
            "second deposit must see debt already settled; was {} before the CRIT-FM-2 fix",
            r.deposit_events[1].pending_reward
        );
    }

    /// CRIT-FM-2 regression: deposit-then-harvest from the same user
    /// in one batch must settle rewards exactly once. Under the bug
    /// the harvest re-claimed the same pending.
    #[test]
    fn crit_fm_2_deposit_then_harvest_settles_once() {
        let pool = mk_pool();
        let user = [7u8; 32];

        let dep = mk_intent(FarmIntentType::Deposit, user, 100, 1000, 0);
        let harv = mk_intent(FarmIntentType::Harvest, user, 0, 1000, 0);

        let r = solve_batch(&[(1, dep), (2, harv)], &pool, 100);

        assert_eq!(r.deposit_events[0].pending_reward, 2000,
            "deposit absorbs the pre-batch pending");
        assert_eq!(r.harvest_events[0].reward_amount, 0,
            "harvest after same-user deposit in same batch must see zero pending");
    }

    /// CRIT-FM-2 regression: distinct users in the same batch are
    /// independent. Two users each doing a deposit should each get
    /// their own pre-batch pending, not share it.
    #[test]
    fn crit_fm_2_distinct_users_are_independent() {
        let pool = mk_pool();
        let alice = [1u8; 32];
        let bob = [2u8; 32];

        let a = mk_intent(FarmIntentType::Deposit, alice, 100, 1000, 0);
        let b = mk_intent(FarmIntentType::Deposit, bob, 100, 500, 0);

        let r = solve_batch(&[(1, a), (2, b)], &pool, 100);

        // Alice: 1000 * 2 - 0 = 2000
        // Bob:   500  * 2 - 0 = 1000
        assert_eq!(r.deposit_events[0].pending_reward, 2000);
        assert_eq!(r.deposit_events[1].pending_reward, 1000);
    }

    /// CRIT-FM-2 regression: withdraw-then-withdraw from the same
    /// user must track the running stake, not the pre-batch stake.
    /// Before the fix, a user with 1000 staked could "withdraw 800"
    /// twice because each intent saw stake=1000.
    #[test]
    fn crit_fm_2_running_stake_prevents_overdraw() {
        let pool = mk_pool();
        let user = [5u8; 32];

        let w1 = mk_intent(FarmIntentType::Withdraw, user, 800, 1000, 0);
        let w2 = mk_intent(FarmIntentType::Withdraw, user, 800, 1000, 0);

        let r = solve_batch(&[(1, w1), (2, w2)], &pool, 100);

        assert_eq!(r.withdraw_events.len(), 1,
            "first withdraw succeeds against running stake 1000");
        assert_eq!(r.refunded.len(), 1,
            "second withdraw (800 > running stake 200) must be refunded, \
             not silently executed");
        assert_eq!(r.refunded[0].0, 2, "refund is for intent 2");
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
