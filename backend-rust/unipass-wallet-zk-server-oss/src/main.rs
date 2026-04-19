use std::sync::Arc;

use actix_cors::Cors;
use actix_web::{App, HttpServer, web::Data};
use anyhow::Context as _;

use unipass_wallet_zk_server_oss::{
    api::{self, AppState},
    config::Config,
    daos, logger, mq,
};

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let cfg = Arc::new(Config::from_env().context("load config")?);
    logger::init(cfg.log_json);

    tracing::info!(bind = %cfg.bind, port = cfg.port, "unipass-wallet-zk-server starting");

    let db = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(cfg.mysql.max_connections)
        .connect(&cfg.mysql.url())
        .await
        .context("connect mysql")?;
    daos::migrate(&db).await.context("run migrations")?;

    let redis = mq::build_pool(&cfg.redis.url()).context("redis pool")?;
    mq::ensure_group(&redis, &cfg.task_stream, &cfg.consumer_group)
        .await
        .context("create consumer group")?;

    // Load zk params — TODO(oss): real impls read SRS blobs off disk.
    tracing::info!(path = %cfg.zk.srs_1024_path, "Params 1024 Load finished");
    tracing::info!(path = %cfg.zk.srs_2048_path, "Params 2048 Load finished");
    if cfg.zk.pc_key_path.is_some() {
        tracing::info!("PCKey Load finished");
    }

    let state = Data::new(AppState {
        db: db.clone(),
        redis: redis.clone(),
        config: cfg.clone(),
    });

    let bind = (cfg.bind.clone(), cfg.port);
    let server = HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(Cors::permissive())
            .configure(api::configure)
    })
    .bind(bind.clone())
    .with_context(|| format!("bind {}:{}", bind.0, bind.1))?
    .run();

    let handle = server.handle();
    let server_task = tokio::spawn(server);

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

    handle.stop(true).await;
    let _ = server_task.await;
    tracing::info!("shutdown complete");
    Ok(())
}
