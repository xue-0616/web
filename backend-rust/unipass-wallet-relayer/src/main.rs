use actix_web::{web, App, HttpServer, HttpResponse};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod security;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = configs::load_config().await?;
    let port = config.port;

    // --- Security: validate and secure the relayer private key ---
    let _secure_key = if !config.relayer_private_key.is_empty() {
        let key = security::SecurePrivateKey::from_hex(&config.relayer_private_key)
            .map_err(|e| anyhow::anyhow!("Invalid RELAYER_PRIVATE_KEY: {}", e))?;
        tracing::info!("Relayer private key loaded and validated (32 bytes)");
        // Remove from process environment to limit exposure
        std::env::remove_var("RELAYER_PRIVATE_KEY");
        Some(key)
    } else {
        tracing::warn!("RELAYER_PRIVATE_KEY not set — transaction signing will fail");
        None
    };

    // --- Security: load API key from environment ---
    let relayer_api_key = std::env::var("RELAYER_API_KEY")
        .unwrap_or_else(|_| {
            tracing::warn!("RELAYER_API_KEY not set — all authenticated endpoints will be rejected");
            String::new()
        });

    // --- Security: load allowed CORS origins ---
    let cors_origins: Vec<String> = std::env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let db = sea_orm::Database::connect(&config.database_url).await?;
    let redis_cfg = deadpool_redis::Config::from_url(&config.redis_url);
    let redis_pool = redis_cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;

    let ctx = api::context::RelayerContext::new(db, redis_pool, config.clone());

    // Background: Redis stream consumer for transaction processing
    let ctx_bg = ctx.clone();
    tokio::spawn(async move {
        relayer_redis::start_consumer(ctx_bg).await;
    });

    tracing::info!("Starting wallet-relayer on port {}", port);
    HttpServer::new(move || {
        // --- CORS: restricted origins ---
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
            .wrap(cors)
            .wrap(security::RateLimiter::new(60, 60)) // 60 req/min per IP
            .wrap(security::ApiKeyAuth::new(relayer_api_key.clone()))
            .route("/health", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status":"ok"})) }))
            .app_data(web::Data::new(ctx.clone()))
            .configure(relayer::configure_routes)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await?;
    Ok(())
}
