use api_common::context::AppContext;
use anyhow::Result;

/// Background loop entry point called from main.rs.
///
/// # HIGH-FM-3 safety gate
///
/// `process_all_farms` is currently a debug-log-only placeholder —
/// the real batch-tx builder that would actually advance
/// `farm_intents` through `Pending → Processing → Completed` has
/// never been implemented in this snapshot. Running the loop
/// anyway creates the illusion of a working system (it scans the
/// table every 3s and logs "Checking farm pool: …") while user
/// intents pile up with no resolution.
///
/// To prevent that, we return immediately unless
/// `config.farm_processing_enabled` is set to true. When the real
/// solver lands, flip the env var and the loop starts processing.
///
/// The submit handlers also consult this flag and refuse new
/// intents with HTTP 503, so disabling the loop here is not a
/// loss-of-safety situation — it's the opposite: no data flows
/// into a dead-end queue.
pub async fn start(ctx: AppContext) -> Result<()> {
    if !ctx.config.farm_processing_enabled {
        tracing::warn!(
            "Pools-manager loop is idle because FARM_PROCESSING_ENABLED is \
             not set (HIGH-FM-3). No farm intents will be processed, and \
             submissions are refused at the API layer. This is intentional."
        );
        return Ok(());
    }

    let mut interval = tokio::time::interval(std::time::Duration::from_secs(3));
    loop {
        interval.tick().await;
        if let Err(e) = process_all_farms(&ctx).await {
            tracing::error!("Farm pools processing error: {}", e);
        }
    }
}

/// Main farm pools processing loop.
///
/// For each active farm in the DB, invoke the HIGH-FM-3 scaffold
/// pipeline with `NoopBatchTxBuilder`.  The scaffold handles:
///
///   * Selecting the next batch (FIFO + dedup + cap)
///   * Atomic claim via `UPDATE WHERE status=Pending`
///   * Calling the builder (Noop → `NotImplemented`)
///   * Releasing the claim on `NotImplemented`
///
/// Until the real `impl BatchTxBuilder` lands, every tick just
/// claims and releases — exercising the DB path end-to-end without
/// ever touching on-chain state.  Users who've submitted intents
/// will see their rows bounce Pending → Processing → Pending in
/// the DB, which is the desired observable behaviour during
/// rollout (monitors can check that the loop is alive) and is a
/// harmless no-op on funds.
///
/// Kept separate from `start` so tests can invoke it directly
/// without spawning the 3s interval.
pub async fn process_all_farms(ctx: &AppContext) -> Result<()> {
    use crate::pools_manager::batch_tx_builder::NoopBatchTxBuilder;
    use crate::pools_manager::pools_handler::handler::process_farm_intents_with_builder;
    use entity_crate::farm_pools;
    use sea_orm::*;

    let active_farms = farm_pools::Entity::find().all(ctx.db()).await?;

    // One builder instance per tick is fine — NoopBatchTxBuilder
    // is zero-sized and stateless.  When a real builder lands it
    // will likely need to be constructed once at startup and
    // threaded through via `ctx`; that's a ~10-line change to
    // `start()` above.
    let builder = NoopBatchTxBuilder;

    // HIGH-FM-3 scaffold-tested batch size.  If this ever becomes
    // configurable, keep the default at 50 — the scaffold tests
    // (`batch_tx_builder::tests`) pin this value.
    const MAX_BATCH_SIZE: usize = 50;

    for farm in active_farms {
        let farm_hash = hex::encode(&farm.farm_type_hash);
        tracing::debug!("Processing farm pool: {}", farm_hash);
        if let Err(e) = process_farm_intents_with_builder(
            ctx.db(),
            &farm.farm_type_hash,
            &builder,
            MAX_BATCH_SIZE,
        )
        .await
        {
            // Per-farm errors should never abort the whole tick;
            // another farm's pool cell has nothing to do with
            // this one's DB lock contention or RPC flake.  Log
            // and move on.
            tracing::error!(
                "farm {}: process_farm_intents_with_builder failed: {}",
                farm_hash,
                e
            );
        }
    }
    Ok(())
}
