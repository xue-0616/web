use std::sync::Arc;

use anyhow::Context as _;
use jsonrpsee::server::Server;

use paymaster_service_oss::{
    config::Config,
    paymaster::Paymaster,
    rpc::{PaymasterRpcImpl, PaymasterRpcServer as _},
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    if std::env::var("LOG_OUTPUT_FORMAT").as_deref() == Ok("json") {
        tracing_subscriber::fmt().with_env_filter(env_filter).json().init();
    } else {
        tracing_subscriber::fmt().with_env_filter(env_filter).init();
    }

    let cfg = Arc::new(Config::from_env().context("load config")?);
    let paymaster = Arc::new(Paymaster::new(cfg.clone()).context("construct paymaster")?);
    tracing::info!(
        bind = %cfg.bind,
        signer = %paymaster.signer_address(),
        chains = ?paymaster.supported_chain_ids(),
        whitelist_size = cfg.whitelist.len(),
        "paymaster-service starting"
    );

    let server = Server::builder()
        .build(&cfg.bind)
        .await
        .with_context(|| format!("bind {}", cfg.bind))?;
    let module = PaymasterRpcImpl { paymaster }.into_rpc();
    let handle = server.start(module);

    // Block until SIGTERM / SIGINT
    tokio::select! {
        _ = tokio::signal::ctrl_c() => tracing::info!("SIGINT received"),
        r = async {
            #[cfg(unix)] {
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                    .expect("SIGTERM handler").recv().await;
            }
            #[cfg(not(unix))] { std::future::pending::<()>().await; }
            Ok::<(), std::io::Error>(())
        } => { tracing::info!("SIGTERM received: {r:?}"); }
    }

    tracing::info!("shutting down");
    handle.stop()?;
    handle.stopped().await;
    Ok(())
}
