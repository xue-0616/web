use std::sync::Arc;

use actix_cors::Cors;
use actix_web::{App, HttpServer, web::Data};
use anyhow::Context as _;
use tokio::sync::watch;

use asset_migrator_oss::{
    api::{self, AppState},
    config::AssetMigratorConfigs,
    daos,
    logger,
    services::{
        custody_wallet::HttpCustodyWalletClient,
        deposit_address::DepositAddressService,
    },
    workers::{self, Context as WorkerCtx},
};

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    let cfg = AssetMigratorConfigs::load(None).context("load config")?;
    logger::init(cfg.log_json_format);

    tracing::info!(
        bind = %cfg.bind, port = cfg.port,
        mysql_host = %cfg.sql_db.host,
        inbound_chains = cfg.inbound_chain_infos.len(),
        outbound_chains = cfg.outbound_chain_infos.len(),
        "AssetMigrator service starting",
    );

    // ---- DB pool ----
    let db = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(cfg.sql_db.max_connections)
        .connect(&cfg.sql_db.url())
        .await
        .context("connect mysql")?;
    daos::migrate(&db).await.context("run migrations")?;

    // ---- Redis pool ----
    let redis_cfg = deadpool_redis::Config::from_url(cfg.redis.url());
    let redis = redis_cfg
        .create_pool(Some(deadpool_redis::Runtime::Tokio1))
        .context("create redis pool")?;

    // ---- Custody wallet client ----
    let custody: Arc<dyn asset_migrator_oss::services::custody_wallet::CustodyWalletClient> =
        Arc::new(HttpCustodyWalletClient::new(&cfg.custody_wallet_client)?);

    // ---- Service layer ----
    let deposit_addresses = Arc::new(DepositAddressService {
        pool: db.clone(),
        custody: custody.clone(),
        address_batch_threshold: cfg.address_batch_threshold,
    });

    // ---- Shared state ----
    let cfg_arc = Arc::new(cfg.clone());
    let state = Data::new(AppState {
        db: db.clone(),
        config: cfg_arc.clone(),
        deposit_addresses: deposit_addresses.clone(),
    });

    // ---- Workers ----
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let worker_ctx = WorkerCtx {
        db: db.clone(),
        redis,
        custody,
        config: cfg_arc.clone(),
    };
    let h_indexer = tokio::spawn(workers::deposit_indexer::run(worker_ctx.clone(), shutdown_rx.clone()));
    let h_processor = tokio::spawn(workers::tx_processor::run(worker_ctx.clone(), shutdown_rx.clone()));
    let h_submitter = tokio::spawn(workers::submitter::run(worker_ctx, shutdown_rx.clone()));

    // ---- HTTP server ----
    let bind_addr = (cfg.bind.clone(), cfg.port);
    let server = HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(Cors::permissive()) // TODO(oss): restrict in prod via CORS_ALLOWED_ORIGINS
            .configure(api::configure)
    })
    .bind(bind_addr.clone())
    .with_context(|| format!("bind {}:{}", bind_addr.0, bind_addr.1))?
    .run();

    let server_handle = server.handle();
    let server_task = tokio::spawn(server);

    // ---- Signal handling ----
    tokio::select! {
        _ = tokio::signal::ctrl_c() => tracing::info!("SIGINT received"),
        r = async {
            #[cfg(unix)] {
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                    .expect("install SIGTERM handler").recv().await;
            }
            #[cfg(not(unix))] { futures::future::pending::<()>().await; }
            Ok::<(), std::io::Error>(())
        } => { tracing::info!("SIGTERM received: {r:?}"); }
    }

    let _ = shutdown_tx.send(true);
    server_handle.stop(true).await;
    let _ = server_task.await;
    let _ = tokio::join!(h_indexer, h_processor, h_submitter);
    tracing::info!("shutdown complete");
    Ok(())
}
