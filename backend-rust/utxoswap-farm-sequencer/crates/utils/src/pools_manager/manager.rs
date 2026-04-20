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
/// NOTE: This is still a placeholder walker — it proves DB
/// connectivity and enumerates pools but does not yet build or
/// broadcast batch transactions. Kept separate from `start` so
/// tests can invoke it directly without spawning the 3s interval.
pub async fn process_all_farms(ctx: &AppContext) -> Result<()> {
    use entity_crate::farm_pools;
    use sea_orm::*;
    let active_farms = farm_pools::Entity::find()
        .all(ctx.db()).await?;

    for farm in active_farms {
        let farm_hash = hex::encode(&farm.farm_type_hash);
        tracing::debug!("Checking farm pool: {}", farm_hash);
    }
    Ok(())
}
