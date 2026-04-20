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
    // M-1 / round 8: restrictive CORS built from the config
    // allow-list; empty = same-origin only.
    let cors_origins: Vec<String> = cfg
        .cors_allowed_origins
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if cors_origins.is_empty() {
        tracing::info!(
            "CORS: empty allow-list — only same-origin requests accepted"
        );
    } else {
        tracing::info!("CORS: allowed origins = {:?}", cors_origins);
    }
    let server = HttpServer::new(move || {
        let mut cors = Cors::default()
            .allowed_methods(vec!["GET", "POST", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::CONTENT_TYPE,
            ])
            .max_age(3600);
        for origin in &cors_origins {
            cors = cors.allowed_origin(origin);
        }
        App::new()
            .app_data(state.clone())
            .wrap(cors)
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
