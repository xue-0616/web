pub mod monitor;
pub mod utils;

use api::ValidatorContext;
use tokio_util::sync::CancellationToken;

/// Background: monitor bridge events on all supported chains.
/// Supports graceful shutdown via CancellationToken.
pub async fn start(ctx: ValidatorContext, cancel: CancellationToken) {
    tracing::info!("Bridge monitor started");

    // Build chain configs from DB
    let mut chains = match monitor::build_chain_configs(&ctx).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to build chain configs: {}", e);
            return;
        }
    };

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                tracing::info!("Bridge monitor shutting down gracefully");
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(3)) => {
                // Refresh chain configs periodically
                if let Ok(new_chains) = monitor::build_chain_configs(&ctx).await {
                    chains = new_chains;
                }

                if let Err(e) = monitor::poll_events(&ctx, &chains).await {
                    tracing::error!("Monitor error: {}", e);
                }
            }
        }
    }
}
