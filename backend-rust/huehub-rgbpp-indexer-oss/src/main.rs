use std::sync::Arc;

use anyhow::Context as _;
use jsonrpsee::server::ServerBuilder;

use huehub_rgbpp_indexer_oss::{
    config::Config,
    logger,
    redb_dao::RedbDao,
    rpc,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let cfg = Config::from_env().context("load config")?;
    logger::init(cfg.log_json);

    tracing::info!(bind = %cfg.bind, port = cfg.port, db = %cfg.db_path, "rgbpp-indexer starting");

    let dao = Arc::new(
        RedbDao::open(std::path::Path::new(&cfg.db_path))
            .context("open redb database")?,
    );
    let module = rpc::build_module(dao);

    let addr = format!("{}:{}", cfg.bind, cfg.port);
    let server = ServerBuilder::default().build(&addr).await
        .with_context(|| format!("bind {addr}"))?;
    let handle = server.start(module);

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

    handle.stop()?;
    handle.stopped().await;
    tracing::info!("shutdown complete");
    Ok(())
}
