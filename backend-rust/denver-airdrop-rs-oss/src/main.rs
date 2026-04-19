use anyhow::Context as _;

use denver_airdrop_rs_oss::{config::Config, logger};

fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .context("build tokio runtime")?;
    rt.block_on(async move {
        let cfg = Config::from_env().context("load config")?;
        logger::init(cfg.log_json);
        tracing::info!(rpc = %cfg.rpc_url, from_block = cfg.from_block, "denver-airdrop-rs starting");

        // TODO(oss): wire ethers Provider + SignerMiddleware +
        // NonceManagerMiddleware and drive the pagination loop using
        // `block_range::paginate`, `dedup::filter_new`, and
        // `statefile::{load,save}`. The business logic is fully
        // library-side (see lib.rs); only the on-chain connector is
        // deployment-specific.

        tokio::select! {
            _ = tokio::signal::ctrl_c() => tracing::info!("SIGINT received"),
            _ = async {
                #[cfg(unix)] {
                    tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                        .expect("SIGTERM handler").recv().await;
                }
                #[cfg(not(unix))] { std::future::pending::<()>().await; }
            } => tracing::info!("SIGTERM received"),
        }
        tracing::info!("shutdown complete");
        Ok::<_, anyhow::Error>(())
    })
}
