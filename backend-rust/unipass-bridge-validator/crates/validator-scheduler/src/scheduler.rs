use api::ValidatorContext;

/// Batch validated payments and submit to bridge contract.
/// Called periodically by the scheduler loop.
pub async fn run_batch(ctx: &ValidatorContext) -> anyhow::Result<()> {
    // Build chain configs from DB
    let chains = validator_monitor::monitor::build_chain_configs(ctx).await?;

    if chains.is_empty() {
        tracing::debug!("No chain configs available, skipping batch scan");
        return Ok(());
    }

    // Poll for new bridge events on all chains
    if let Err(e) = validator_monitor::monitor::poll_events(ctx, &chains).await {
        tracing::error!("Bridge monitor scan error: {}", e);
    }

    Ok(())
}
