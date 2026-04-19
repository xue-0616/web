pub mod scheduler;

use api::ValidatorContext;
use tokio_util::sync::CancellationToken;

/// Background: schedule batched payment submissions.
/// Supports graceful shutdown via CancellationToken.
pub async fn start(ctx: ValidatorContext, cancel: CancellationToken) {
    tracing::info!("Validator scheduler started");
    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                tracing::info!("Validator scheduler shutting down gracefully");
                break;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(10)) => {
                if let Err(e) = scheduler::run_batch(&ctx).await {
                    tracing::error!("Scheduler error: {}", e);
                }
            }
        }
    }
}
