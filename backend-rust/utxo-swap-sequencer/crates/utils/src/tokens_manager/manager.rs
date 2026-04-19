use api_common::context::AppContext;
use std::time::Duration;

/// Token manager — periodically updates token info, prices, and popularity rankings
pub async fn start(ctx: AppContext) -> anyhow::Result<()> {
    tracing::info!("Tokens manager started");

    let mut interval = tokio::time::interval(Duration::from_secs(60));

    loop {
        interval.tick().await;

        // Update token prices from external oracles
        if let Err(e) = super::price_oracle::update_prices(&ctx).await {
            tracing::error!("Price oracle update error: {}", e);
        }

        // Update popular tokens list
        if let Err(e) = super::popular_tokens_updater::update_popular_tokens(&ctx).await {
            tracing::error!("Popular tokens update error: {}", e);
        }

        // Scan for new xUDT tokens
        if let Err(e) = super::xudt_updater::scan_xudt_tokens(&ctx).await {
            tracing::error!("xUDT scan error: {}", e);
        }
    }
}
