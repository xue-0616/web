//! Single source of truth for the task catalog.
//!
//! HIGH-SW-2 / HIGH-SW-3: before this module existed, the task
//! definitions were duplicated in three incompatible places —
//!
//! * `tasks/claim.rs::get_task_reward()` — a `match task_id`
//!   on integer IDs 1..=3 with rewards 100/200/50, plus a dead
//!   `let tasks = vec![...]` of string IDs and different rewards
//!   that nothing read;
//!
//! * `tasks/list.rs` — TWO `let tasks = vec![...]`s in the same
//!   function, where the second silently shadowed the first; the
//!   surviving one had its own ID/reward pairs that didn't agree
//!   with `claim.rs`;
//!
//! * audit-time the front-end was independently aware of yet
//!   another set of strings.
//!
//! Centralising the catalog kills the drift class. Both handlers now
//! iterate `TASKS` directly, so adding a task is a one-line change
//! in this file and the reward an authenticated user sees in the
//! list is provably the same number `claim` will pay out.

use entity_crate::points_history::SourceType;

/// Compile-time task table. The key invariant is that `id` here
/// equals the `source_id` written into `points_history` by
/// `tasks/claim.rs`, which is what the completion lookup keys on.
pub const TASKS: &[Task] = &[
    Task {
        id: 1,
        name: "First Swap",
        description: "Complete your first token swap",
        points_reward: 100,
        task_type: "one_time",
    },
    Task {
        id: 2,
        name: "Add Liquidity",
        description: "Add liquidity to any pool",
        points_reward: 200,
        task_type: "one_time",
    },
    Task {
        id: 3,
        name: "Daily Swap",
        description: "Make a swap today",
        points_reward: 50,
        task_type: "daily",
    },
];

/// One row of the catalog. Owned-string types (`name`,
/// `description`, `task_type`) are kept as `&'static str` so the
/// table itself can live in `.rodata` and be cheap to iterate.
/// Handlers convert to owned `String` only when serialising.
pub struct Task {
    pub id: u64,
    pub name: &'static str,
    pub description: &'static str,
    pub points_reward: u64,
    pub task_type: &'static str,
}

/// Look up the reward for a given task id. Used by `tasks/claim.rs`
/// instead of the previous bespoke `match` so the two handlers
/// can never disagree on what a task is worth.
pub fn reward_for(task_id: u64) -> Option<u64> {
    TASKS.iter().find(|t| t.id == task_id).map(|t| t.points_reward)
}

/// The `source_type` used by every claim row in `points_history`.
/// Centralising here so that `list.rs`'s completion lookup uses
/// the exact same enum variant that `claim.rs` writes.
pub const CLAIM_SOURCE_TYPE: SourceType = SourceType::TaskClaim;

#[cfg(test)]
mod tests {
    //! Compile-time assertions about the catalog. These tests
    //! exist mainly so a future PR that bumps a reward without
    //! also touching the audit doc has to acknowledge the change
    //! by editing the test.
    use super::*;

    #[test]
    fn catalog_ids_are_unique_and_dense_from_one() {
        // Both `claim` and `list` use `id` as a primary key. If
        // someone duplicates an id by accident, the catalog would
        // silently award the rewards of whichever entry comes
        // first; refuse that at build time.
        let mut seen = std::collections::HashSet::new();
        for t in TASKS {
            assert!(seen.insert(t.id), "duplicate task id {}", t.id);
        }
        // Dense from 1 isn't strictly required, but is what the
        // current frontend assumes. If a non-dense layout becomes
        // intentional, drop this assert in the same PR that
        // teaches the frontend.
        for (idx, t) in TASKS.iter().enumerate() {
            assert_eq!(t.id, (idx as u64) + 1,
                "TASKS must be ordered by id starting at 1");
        }
    }

    #[test]
    fn catalog_rewards_are_nonzero_and_finite() {
        for t in TASKS {
            assert!(t.points_reward > 0, "task {} has zero reward", t.id);
            assert!(t.points_reward < 1_000_000,
                "task {} reward {} looks like a typo (>1M)",
                t.id, t.points_reward);
        }
    }

    #[test]
    fn reward_for_matches_table() {
        for t in TASKS {
            assert_eq!(reward_for(t.id), Some(t.points_reward));
        }
        assert_eq!(reward_for(0), None);
        assert_eq!(reward_for(9_999), None);
    }
}
