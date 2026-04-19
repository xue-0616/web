use api_common::context::AppContext;

/// Main processing loop: scan active farm pools, process intents
pub async fn run(ctx: AppContext) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(3));
    loop {
        interval.tick().await;
        if let Err(e) = super::super::manager::process_all_farms(&ctx).await {
            tracing::error!("Farm pools handler error: {}", e);
        }
    }
}
