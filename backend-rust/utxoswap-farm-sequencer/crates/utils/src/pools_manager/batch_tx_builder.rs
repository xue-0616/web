//! `BatchTxBuilder` trait — the one seam between the pools-manager
//! loop and the eventual CKB batch-tx assembler.
//!
//! # HIGH-FM-3 scaffold (round 9)
//!
//! The full HIGH-FM-3 functional gap (batch a pool's pending
//! intents into one CKB transaction, broadcast it, and advance the
//! `farm_intents` rows from `Pending → Processing → Completed`)
//! spans several concerns:
//!
//!   1. Which pending rows belong to the next batch?
//!      (deterministic, no RPC) ← `select_next_batch` below
//!   2. How do we atomically claim those rows so two replicas
//!      can't pick the same intents?
//!      (single UPDATE … WHERE status=Pending, later PR)
//!   3. How do we translate a `Vec<Model>` into CKB tx inputs,
//!      mutate the pool cell, and sign? ← the `BatchTxBuilder`
//!      trait hides this; the real impl owns the CKB chemistry.
//!   4. How do we roll back when step 3 fails so the rows go back
//!      to `Pending` and nothing is stranded in `Processing`?
//!      (paired UPDATE, later PR)
//!
//! This module covers step 1 and the step-3 trait. Step 2 & 4 land
//! once we can run against a real MySQL in CI (integration-smoke
//! workflow, round 8) so they can be regression-tested end-to-end.
//!
//! # Security notes
//!
//! * `select_next_batch` is **pure** — no network, no DB, no time.
//!   That's deliberate: the ordering / dedup / cap decisions are
//!   the only thing that can cause double-spend at this layer, so
//!   we want them in a unit-testable function with zero I/O.
//!
//! * The trait is `async` + `Send + Sync` so a single instance can
//!   be shared across the background loop's tokio tasks without
//!   locks.
//!
//! * Every variant of `BuildError` is something the loop **must
//!   not** silently swallow; see the variant docs.

use std::fmt;

/// Minimal candidate struct passed into `select_next_batch`.
///
/// Mirrors the subset of `entity_crate::farm_intents::Model` that
/// actually participates in ordering / dedup decisions, so unit
/// tests don't need a full sea-orm `Model` constructed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct IntentCandidate {
    /// Primary key on the `farm_intents` table.
    pub id: u64,
    /// Origin CKB transaction for the intent cell. Combined with
    /// `cell_index`, uniquely identifies the on-chain intent.
    pub cell_tx_hash: Vec<u8>,
    /// Output index of the intent cell inside `cell_tx_hash`.
    pub cell_index: u32,
    /// Unix-seconds creation time. Used for FIFO ordering.
    pub created_at_secs: i64,
}

/// Pick the next batch of intents to process, in stable order,
/// with duplicates removed.
///
/// # Ordering contract
///
/// Results are returned in FIFO order: ascending `created_at_secs`,
/// breaking ties by ascending `id`. This matches the SQL query in
/// `handler::process_farm_intents` that runs upstream, so the
/// batch we build here is the same one the DB-layer claim would
/// target.
///
/// # Dedup contract
///
/// Two candidates with the same `(cell_tx_hash, cell_index)` are
/// collapsed into one (the earliest-inserted row wins). This is
/// defensive — the submit handler already has a duplicate check,
/// but a race between two concurrent `submit` requests on the same
/// cell could theoretically insert two rows before either commit
/// is visible to the other. If that ever happened we'd rather drop
/// the dup here than build a CKB tx that tries to consume the same
/// input cell twice (which the CKB verifier would reject, leaving
/// both rows stuck in `Processing`).
///
/// # Cap contract
///
/// `max_size == 0` returns an empty vec (useful for "throttle to
/// zero" during emergency drains).  `max_size > input.len()` is
/// fine — we return whatever we have.
pub fn select_next_batch(
    candidates: &[IntentCandidate],
    max_size: usize,
) -> Vec<u64> {
    if max_size == 0 || candidates.is_empty() {
        return Vec::new();
    }

    // Sort a clone by (created_at, id) so we don't mutate the
    // caller's slice. The upstream SQL already orders by
    // `created_at ASC` so this is normally a no-op, but doing it
    // here lets unit tests pass arbitrary orderings and still rely
    // on the FIFO invariant.
    let mut sorted: Vec<&IntentCandidate> = candidates.iter().collect();
    sorted.sort_by(|a, b| {
        a.created_at_secs
            .cmp(&b.created_at_secs)
            .then_with(|| a.id.cmp(&b.id))
    });

    let mut seen_cells: std::collections::HashSet<(Vec<u8>, u32)> =
        std::collections::HashSet::new();
    let mut out = Vec::with_capacity(max_size.min(sorted.len()));
    for c in sorted {
        if out.len() >= max_size {
            break;
        }
        let key = (c.cell_tx_hash.clone(), c.cell_index);
        if seen_cells.insert(key) {
            out.push(c.id);
        }
    }
    out
}

/// Failure modes the builder can surface.
///
/// None of these are "retry silently" — each variant carries
/// recovery semantics the caller must respect.
#[derive(Debug)]
pub enum BuildError {
    /// The builder is not yet wired up. The loop should treat
    /// this as a signal to leave the claimed rows alone and wait
    /// for a future tick; NOT as a reason to mark them `Failed`.
    /// Returned by `NoopBatchTxBuilder` so flipping
    /// `FARM_PROCESSING_ENABLED=true` without a real builder is
    /// still inert — no rows transition past the claim stage.
    NotImplemented(&'static str),
    /// Input data was malformed in a way the CKB verifier would
    /// certainly reject (e.g. pool cell data length mismatch).
    /// The loop should mark the affected rows `Failed` so they
    /// stop being retried on every tick.
    InvalidInput(String),
    /// Transient infra failure (CKB RPC timeout, Redis drop).
    /// Loop should release the claim so the next tick retries.
    Transient(String),
}

impl fmt::Display for BuildError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BuildError::NotImplemented(s) => write!(f, "builder not implemented: {s}"),
            BuildError::InvalidInput(s) => write!(f, "invalid builder input: {s}"),
            BuildError::Transient(s) => write!(f, "transient builder failure: {s}"),
        }
    }
}

impl std::error::Error for BuildError {}

/// Hash of the CKB transaction the builder produced. Opaque bytes
/// here so this crate doesn't pull in ckb-types; the caller is
/// expected to hex-encode or pass through as needed.
pub type TxHash = Vec<u8>;

/// Produce a batch CKB transaction for a pool given the pending
/// intents it should consume.
///
/// Implementations must be pure relative to their inputs — the
/// loop may call this multiple times with the same inputs during
/// retry, and we need idempotency so a transient RPC failure on
/// broadcast doesn't produce two different txs.
#[async_trait::async_trait]
pub trait BatchTxBuilder: Send + Sync {
    /// * `pool_cell_data` — current on-chain bytes of the pool
    ///   cell's `data` field. The real impl will deserialize this
    ///   into a typed struct and mutate `acc_reward_per_share` /
    ///   `total_staked` accordingly.
    /// * `intent_cells` — the raw cell_data bytes of each intent
    ///   cell to consume, in the same order they should appear as
    ///   inputs in the resulting CKB tx.
    async fn build(
        &self,
        pool_cell_data: &[u8],
        intent_cells: &[Vec<u8>],
    ) -> Result<TxHash, BuildError>;
}

/// Default builder — does nothing and returns `NotImplemented`.
///
/// Used when `FARM_PROCESSING_ENABLED=true` but no real builder
/// has been plugged in yet, so the loop goes through all the
/// motions (claim lock, pick batch, call builder) without risking
/// any on-chain side effects.
pub struct NoopBatchTxBuilder;

#[async_trait::async_trait]
impl BatchTxBuilder for NoopBatchTxBuilder {
    async fn build(
        &self,
        _pool_cell_data: &[u8],
        _intent_cells: &[Vec<u8>],
    ) -> Result<TxHash, BuildError> {
        Err(BuildError::NotImplemented(
            "NoopBatchTxBuilder: HIGH-FM-3 real impl not yet wired",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ic(id: u64, tx: &[u8], idx: u32, t: i64) -> IntentCandidate {
        IntentCandidate {
            id,
            cell_tx_hash: tx.to_vec(),
            cell_index: idx,
            created_at_secs: t,
        }
    }

    #[test]
    fn empty_input_returns_empty() {
        assert!(select_next_batch(&[], 10).is_empty());
    }

    #[test]
    fn zero_max_returns_empty() {
        let c = vec![ic(1, b"tx", 0, 100)];
        assert!(select_next_batch(&c, 0).is_empty());
    }

    #[test]
    fn orders_by_created_at_then_id() {
        let c = vec![
            ic(3, b"a", 0, 200),
            ic(1, b"b", 0, 100),
            ic(2, b"c", 0, 100), // tied created_at with id=1; id=1 wins FIFO
        ];
        assert_eq!(select_next_batch(&c, 10), vec![1, 2, 3]);
    }

    #[test]
    fn dedups_by_cell_tx_and_index() {
        // Two rows point at the same on-chain cell; only the
        // FIFO-earlier one survives.
        let c = vec![
            ic(1, b"dup", 5, 100),
            ic(2, b"dup", 5, 110), // same cell, later → drop
            ic(3, b"other", 0, 120),
        ];
        assert_eq!(select_next_batch(&c, 10), vec![1, 3]);
    }

    #[test]
    fn dedup_keeps_different_indexes_on_same_tx() {
        let c = vec![
            ic(1, b"tx", 0, 100),
            ic(2, b"tx", 1, 110),
            ic(3, b"tx", 2, 120),
        ];
        assert_eq!(select_next_batch(&c, 10), vec![1, 2, 3]);
    }

    #[test]
    fn caps_at_max_size() {
        let c: Vec<IntentCandidate> = (0..20)
            .map(|i| ic(i as u64, &[i as u8], 0, i as i64))
            .collect();
        let out = select_next_batch(&c, 5);
        assert_eq!(out, vec![0, 1, 2, 3, 4]);
    }

    #[test]
    fn cap_after_dedup() {
        // Dedup should happen before cap, so having duplicates
        // shouldn't cause us to return fewer than `max_size` if
        // we have enough uniques.
        let c = vec![
            ic(1, b"dup", 0, 100),
            ic(2, b"dup", 0, 110), // dedup with id=1
            ic(3, b"a", 0, 120),
            ic(4, b"b", 0, 130),
            ic(5, b"c", 0, 140),
        ];
        assert_eq!(select_next_batch(&c, 3), vec![1, 3, 4]);
    }

    #[tokio::test]
    async fn noop_builder_returns_not_implemented() {
        let b = NoopBatchTxBuilder;
        let err = b.build(&[0u8; 32], &[vec![1, 2, 3]]).await.unwrap_err();
        match err {
            BuildError::NotImplemented(_) => {}
            other => panic!("expected NotImplemented, got {other:?}"),
        }
    }
}
