use api_common::context::AppContext;

/// Background runner: periodically check for pool creation requests
pub async fn run_pools_creator(ctx: AppContext) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(10));
    loop {
        interval.tick().await;
        if let Err(e) = check_and_create_pools(&ctx).await {
            tracing::error!("Pool creator error: {}", e);
        }
    }
}

async fn check_and_create_pools(_ctx: &AppContext) -> anyhow::Result<()> {
    // Check Redis queue for pending pool creation requests
    // Format: LPOP sequencer:create_pool_queue -> JSON { asset_x_hash, asset_y_hash, ... }
    // If found, call creator::create_pool
    Ok(())
}
