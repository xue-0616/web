use anyhow::Result;

use crate::pools_manager::batch_tx_builder::{
    select_next_batch, BatchTxBuilder, BuildError, IntentCandidate,
};
use crate::pools_manager::intent_state_machine;

/// Legacy entry-point kept for existing callers (`manager::start`
/// et al.) while the batch builder is stubbed. No state
/// transitions happen here — when the pools-manager loop runs
/// with `FARM_PROCESSING_ENABLED=true`, this prints how many
/// intents are pending per pool and returns. The real work lives
/// in `process_farm_intents_with_builder` below, and will replace
/// this function once the CKB builder is plumbed in.
pub async fn process_farm_intents(
    db: &sea_orm::DatabaseConnection,
    farm_type_hash: &[u8],
) -> Result<()> {
    use entity_crate::farm_intents;
    use sea_orm::*;
    let pending = farm_intents::Entity::find()
        .filter(farm_intents::Column::FarmTypeHash.eq(farm_type_hash.to_vec()))
        .filter(farm_intents::Column::Status.eq(farm_intents::FarmIntentStatus::Pending))
        .order_by_asc(farm_intents::Column::CreatedAt)
        .limit(50)
        .all(db)
        .await?;

    if pending.is_empty() {
        return Ok(());
    }
    tracing::info!(
        "Processing {} farm intents for {}",
        pending.len(),
        hex::encode(farm_type_hash)
    );
    Ok(())
}

/// Full HIGH-FM-3 processing loop: query pending → select batch
/// → atomic claim → call builder → transition to terminal state.
///
/// Generic over `BatchTxBuilder` so production wires in the real
/// CKB impl and tests can drop in a fake that returns
/// deterministic `Ok(tx_hash)` / `Err(Transient)` / etc.
///
/// # Error-handling contract
///
/// Every branch below MUST match exactly one of the four
/// terminal transitions defined in
/// [`intent_state_machine`]. A silent early-return with rows
/// still stuck in `Processing` would hang the queue forever.
///
/// * `Ok(tx_hash)` → `mark_completed`
/// * `Err(NotImplemented)` → `release` (next tick retries; this
///   is the NoopBatchTxBuilder path during rollout)
/// * `Err(Transient)` → `release` (infra flake, retry next tick)
/// * `Err(InvalidInput)` → `mark_failed` (terminal, operators
///   see `error_reason` column)
pub async fn process_farm_intents_with_builder<B: BatchTxBuilder>(
    db: &sea_orm::DatabaseConnection,
    farm_type_hash: &[u8],
    builder: &B,
    max_batch_size: usize,
) -> Result<()> {
    use entity_crate::farm_intents;
    use sea_orm::*;

    // 1. Load the candidate set. ORDER BY created_at ASC so the
    //    select_next_batch FIFO contract is honored even if the
    //    DB returns rows in a different order on a future
    //    sea-orm release.
    let pending = farm_intents::Entity::find()
        .filter(farm_intents::Column::FarmTypeHash.eq(farm_type_hash.to_vec()))
        .filter(farm_intents::Column::Status.eq(farm_intents::FarmIntentStatus::Pending))
        .order_by_asc(farm_intents::Column::CreatedAt)
        .limit(max_batch_size as u64)
        .all(db)
        .await?;
    if pending.is_empty() {
        return Ok(());
    }

    // 2. Pure-function selection. Enforces FIFO + dedup + cap.
    //    See batch_tx_builder::select_next_batch for the
    //    security-relevant invariants.
    let candidates: Vec<IntentCandidate> = pending
        .iter()
        .map(|m| IntentCandidate {
            id: m.id,
            cell_tx_hash: m.cell_tx_hash.clone(),
            cell_index: m.cell_index,
            created_at_secs: m.created_at.and_utc().timestamp(),
        })
        .collect();
    let chosen_ids = select_next_batch(&candidates, max_batch_size);
    if chosen_ids.is_empty() {
        return Ok(());
    }

    // 3. Atomic claim. A short return (affected < chosen_ids.len())
    //    means another replica raced us on some rows — those rows
    //    silently drop out of our batch, which is fine: the next
    //    tick will re-query.
    let affected = intent_state_machine::claim(db, &chosen_ids).await?;
    if affected == 0 {
        // All selected rows got stolen by another replica.
        // Count this separately from a healthy "nothing to do"
        // so an alert can fire if the race is chronic.
        metrics::counter!("farm_batch_claim_lost_total").increment(1);
        return Ok(());
    }
    tracing::info!(
        "farm {}: claimed {} of {} selected intents",
        hex::encode(farm_type_hash),
        affected,
        chosen_ids.len()
    );
    metrics::counter!("farm_batch_claimed_intents_total").increment(affected);

    // 4. Placeholder cell-data inputs. The real implementation
    //    will fetch `pool_cell_data` via CKB RPC (get_live_cell
    //    against the farm's pool cell) and populate
    //    `intent_cells` from each claimed row's on-chain cell.
    //    NoopBatchTxBuilder ignores both and returns
    //    NotImplemented, so the placeholder is safe for now.
    let pool_cell_data: Vec<u8> = Vec::new();
    let intent_cells: Vec<Vec<u8>> = vec![Vec::new(); affected as usize];

    // 5. Build + terminal transition. One metric label per branch
    //    so Grafana can split the per-farm throughput by outcome:
    //    completed / failed / released_notimpl / released_transient.
    //    Build latency is a histogram on the happy path only,
    //    because failures are dominated by RPC / timeout times that
    //    don't represent real work done.
    let build_started = std::time::Instant::now();
    match builder.build(&pool_cell_data, &intent_cells).await {
        Ok(tx_hash) => {
            let elapsed = build_started.elapsed().as_secs_f64();
            metrics::histogram!("farm_batch_build_duration_seconds").record(elapsed);
            metrics::counter!("farm_batch_result_total", "result" => "completed")
                .increment(1);
            intent_state_machine::mark_completed(db, &chosen_ids, tx_hash).await?;
        }
        Err(BuildError::NotImplemented(why)) => {
            metrics::counter!("farm_batch_result_total", "result" => "released_notimpl")
                .increment(1);
            tracing::warn!(
                "farm {}: builder returned NotImplemented ({}); releasing claim",
                hex::encode(farm_type_hash),
                why
            );
            intent_state_machine::release(db, &chosen_ids).await?;
        }
        Err(BuildError::Transient(msg)) => {
            metrics::counter!("farm_batch_result_total", "result" => "released_transient")
                .increment(1);
            tracing::warn!(
                "farm {}: transient build failure: {}; releasing claim",
                hex::encode(farm_type_hash),
                msg
            );
            intent_state_machine::release(db, &chosen_ids).await?;
        }
        Err(BuildError::InvalidInput(msg)) => {
            metrics::counter!("farm_batch_result_total", "result" => "failed")
                .increment(1);
            tracing::error!(
                "farm {}: invalid builder input: {}; marking batch failed",
                hex::encode(farm_type_hash),
                msg
            );
            let reason = serde_json::json!({ "kind": "InvalidInput", "msg": msg });
            intent_state_machine::mark_failed(db, &chosen_ids, reason).await?;
        }
    }
    Ok(())
}

// Integration coverage for `process_farm_intents_with_builder`
// lives in the `integration-smoke` workflow (round 8) because
// sea-orm's `MockDatabase` unfortunately drops the `Clone` derive
// on `DatabaseConnection`, which in turn breaks `AppContext::Clone`
// and cascades to every actix handler. The three seams this
// function composes are already unit-tested in isolation:
//
//   * Ordering / dedup / cap:
//     pools_manager::batch_tx_builder::tests (8 tests)
//   * Atomic SQL shape of claim / release / mark_failed /
//     mark_completed:
//     pools_manager::intent_state_machine::tests (5 tests)
//
// Once integration-smoke is green on main, a follow-up PR will
// add an end-to-end test here that seeds a real MySQL with a
// pending row and asserts each of the four BuildError branches
// transitions the row to the expected terminal state.

