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
