use std::sync::Arc;

use actix_cors::Cors;
use actix_web::{App, HttpServer, web::Data};
use anyhow::Context as _;

use unipass_snap_service_oss::{
    api::{self, AppState},
    auth::JwtIssuer,
    config::Config,
    contract::FreeQuotaSigner,
    daos, logger, mq,
};

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let cfg = Arc::new(Config::from_env().context("load config")?);
    logger::init(cfg.log_json);

    tracing::info!(bind = %cfg.bind, port = cfg.port, "snap-server starting");

    // DB
    let db = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(cfg.mysql.max_connections)
        .connect(&cfg.mysql.url())
        .await
        .context("connect mysql")?;
    daos::migrate(&db).await.context("run migrations")?;

    // Redis
    let redis = mq::build_pool(&cfg.redis.url()).context("redis pool")?;

    // JWT
    let jwt = Arc::new(JwtIssuer::new(
        &cfg.jwt.hs256_secret,
        &cfg.jwt.issuer,
        cfg.jwt.token_ttl_secs,
    ));

    // Free-quota signer
    let mut contracts = std::collections::HashMap::new();
    for (cid, addr_s) in &cfg.free_quota_signer.contract_addresses {
        let addr: ethers_core::types::Address =
            addr_s.parse().with_context(|| format!("invalid address for chain {cid}"))?;
        contracts.insert(*cid, addr);
    }
    let signer = Arc::new(
        FreeQuotaSigner::new(&cfg.free_quota_signer.signer_private_key, contracts)
            .context("free-quota signer")?,
    );
    tracing::info!(signer = %signer.signer_address(), chains = ?signer.supported_chains(), "signer ready");

    let state = Data::new(AppState {
        db: db.clone(),
        redis,
        config: cfg.clone(),
        jwt,
        signer,
    });

    let bind = (cfg.bind.clone(), cfg.port);
    // M-1 / round 8: restrictive CORS. Parse the allow-list once
    // so startup logs are explicit; worker threads clone the Vec.
    let cors_origins: Vec<String> = cfg
        .cors_allowed_origins
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if cors_origins.is_empty() {
        tracing::info!(
            "CORS: empty allow-list — only same-origin requests accepted \
             (set cors_allowed_origins in config to allow specific origins)"
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
