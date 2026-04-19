use actix_web::{web, App, HttpServer, HttpResponse};
use sea_orm::Database;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod security;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

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

    let config_ref = api_common::context::EnvConfigRef::new(
        config.ckb_rpc_url.clone(),
        config.ckb_indexer_url.clone(),
        config.sequencer_api_url.clone(),
        config.slack_webhook.clone(),
        admin_addresses,
        admin_pubkeys,
    );
    let ctx = api_common::context::AppContext::new(db, redis_pool, config_ref);

    // Background tasks
    let ctx_pools = ctx.clone();
    tokio::spawn(async move {
        if let Err(e) = utils::pools_manager::manager::start(ctx_pools).await {
            tracing::error!("Pools manager error: {}", e);
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
            .route("/health", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status":"ok"})) }))
            .app_data(web::Data::new(ctx.clone()))
            .configure(api::configure_routes)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await?;

    Ok(())
}
