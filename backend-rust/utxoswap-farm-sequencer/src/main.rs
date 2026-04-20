use actix_web::{web, App, HttpServer};
use huehub_observability::{
    health::{self, ReadinessCheck, ReadinessReport},
    logs, metrics as obs_metrics,
};
use sea_orm::Database;

mod config;
mod security;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Observability: shared JSON-logs init + process-global Prometheus
    // recorder. Mirrors the token-distributor rollout (3d53bfe) so the
    // whole fleet emits the same schema.
    logs::init("utxoswap-farm-sequencer");
    let prom_handle = obs_metrics::install();

    let config = config::EnvConfig::from_env()?;
    let port = config.port;

    // --- Security: load API key from environment ---
    let farm_api_key = std::env::var("FARM_API_KEY")
        .unwrap_or_else(|_| {
            tracing::warn!("FARM_API_KEY not set — all authenticated endpoints will be rejected");
            String::new()
        });

    // --- Security: load allowed CORS origins ---
    let cors_origins: Vec<String> = std::env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Database
    let db = Database::connect(&config.database_url).await?;
    tracing::info!("Database connected");

    // Redis
    let redis_cfg = deadpool_redis::Config::from_url(&config.redis_url);
    let redis_pool = redis_cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;
    tracing::info!("Redis pool created");

    let admin_addresses: Vec<String> = std::env::var("FARM_ADMIN_ADDRESSES")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if admin_addresses.is_empty() {
        tracing::warn!(
            "FARM_ADMIN_ADDRESSES is empty — every privileged intent (e.g. pool creation) will be rejected."
        );
    } else {
        tracing::info!(
            "Loaded {} farm admin address(es) from FARM_ADMIN_ADDRESSES",
            admin_addresses.len()
        );
    }
    let admin_pubkeys: Vec<String> = std::env::var("FARM_ADMIN_PUBKEYS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if !admin_pubkeys.is_empty() {
        tracing::info!(
            "Loaded {} farm admin pubkey(s) from FARM_ADMIN_PUBKEYS (signature verification enabled)",
            admin_pubkeys.len()
        );
    }

    // HIGH-FM-3: fail-closed. The pools-manager background loop is
    // currently a debug-log-only stub; flipping this to `true` without
    // also wiring the real CKB batch-tx builder will accept user LP
    // tokens into the intent table with no way out.
    let farm_processing_enabled = std::env::var("FARM_PROCESSING_ENABLED")
        .ok()
        .as_deref()
        .map(|s| matches!(s.trim().to_ascii_lowercase().as_str(),
                          "1" | "true" | "yes" | "on"))
        .unwrap_or(false);
    if farm_processing_enabled {
        tracing::warn!(
            "FARM_PROCESSING_ENABLED=true — farm intents will be accepted and \
             the pools-manager loop will run. Ensure the batch-tx builder is \
             actually implemented before handling real user funds."
        );
    } else {
        tracing::warn!(
            "FARM_PROCESSING_ENABLED is not set — farm intent submissions \
             will be refused with HTTP 503 and the pools-manager loop is \
             inactive. This is the safe default (HIGH-FM-3)."
        );
    }

    let config_ref = api_common::context::EnvConfigRef::new(
        config.ckb_rpc_url.clone(),
        config.ckb_indexer_url.clone(),
        config.sequencer_api_url.clone(),
        config.slack_webhook.clone(),
        admin_addresses,
        admin_pubkeys,
        farm_processing_enabled,
    );
    let ctx = api_common::context::AppContext::new(db, redis_pool, config_ref);

    // Background tasks
    let ctx_pools = ctx.clone();
    tokio::spawn(async move {
        if let Err(e) = utils::pools_manager::manager::start(ctx_pools).await {
            tracing::error!("Pools manager error: {}", e);
        }
    });

    // Readiness aggregates both upstream deps. 503 => k8s removes the
    // pod from Service endpoints but doesn't kill it (the pools manager
    // and sequencer loops keep retrying in the background).
    let db_ready = ctx.db().clone();
    let redis_ready = ctx.redis_pool().clone();
    let readiness = ReadinessCheck::new(move || {
        let db = db_ready.clone();
        let redis = redis_ready.clone();
        async move {
            let (db_ok, db_detail) = match db.ping().await {
                Ok(()) => (true, None),
                Err(e) => (false, Some(e.to_string())),
            };
            let (redis_ok, redis_detail) = match redis.get().await {
                Ok(_) => (true, None),
                Err(e) => (false, Some(e.to_string())),
            };
            ReadinessReport::from_pairs(&[
                ("db", db_ok, db_detail),
                ("redis", redis_ok, redis_detail),
            ])
        }
    });

    tracing::info!("Starting farm-sequencer on port {}", port);
    HttpServer::new(move || {
        // --- CORS: restricted origins (falls back to deny-all if none configured) ---
        let mut cors = actix_cors::Cors::default()
            .allowed_methods(vec!["GET", "POST", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::HeaderName::from_static("x-api-key"),
            ])
            .max_age(3600);
        for origin in &cors_origins {
            cors = cors.allowed_origin(origin);
        }

        App::new()
            // Order matters: outermost middleware runs first
            .wrap(cors)
            .wrap(security::RateLimiter::new(100, 60, ctx.redis_pool().clone())) // 100 req/min per IP
            .wrap(security::ApiKeyAuth::new(farm_api_key.clone()))
            .wrap(tracing_actix_web::TracingLogger::default())
            // Observability routes (auth-skipped in security.rs).
            .app_data(web::Data::new(prom_handle.clone()))
            .app_data(web::Data::new(readiness.clone()))
            .route("/healthz", web::get().to(health::healthz))
            .route("/readyz", web::get().to(health::readyz))
            .route("/metrics", web::get().to(obs_metrics::metrics_endpoint))
            // Legacy name kept for rollout overlap.
            .route("/health", web::get().to(health::healthz))
            .app_data(web::Data::new(ctx.clone()))
            .configure(api::configure_routes)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await?;

    Ok(())
}
