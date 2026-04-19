use actix_web::{web, App, HttpServer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Build a properly configured CORS policy (FINDING-05).
/// Reads allowed origins from CORS_ALLOWED_ORIGINS config (comma-separated).
/// Falls back to restrictive defaults if not set.
fn build_cors(cfg: &config::PaymentConfig) -> actix_cors::Cors {
    let mut cors = actix_cors::Cors::default()
        .allowed_methods(vec!["GET", "POST"])
        .allowed_headers(vec![
            actix_web::http::header::AUTHORIZATION,
            actix_web::http::header::CONTENT_TYPE,
        ])
        .max_age(3600);

    if cfg.cors_allowed_origins.is_empty() {
        tracing::warn!("CORS_ALLOWED_ORIGINS not set — no origins allowed. Set it to comma-separated origins.");
    } else {
        for origin in cfg.cors_allowed_origins.split(',') {
            let origin = origin.trim();
            if !origin.is_empty() {
                cors = cors.allowed_origin(origin);
            }
        }
    }

    cors
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::load().await?;
    // Config validation already called in from_env() — secrets checked on startup (FINDING-04)
    let port = cfg.port;
    let bind_address = cfg.bind_address.clone(); // FINDING-16: configurable, defaults to 127.0.0.1

    let db = sea_orm::Database::connect(&cfg.database_url).await?;
    let redis_cfg = deadpool_redis::Config::from_url(&cfg.redis_url);
    let redis_pool = redis_cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;

    let ctx = api::context::PaymentContext::new(db, redis_pool, cfg.clone());

    // Background services
    let ctx_bg = ctx.clone();
    tokio::spawn(async move {
        api_utils::payment_manager::submitter::start(ctx_bg).await;
    });
    let ctx_bg2 = ctx.clone();
    tokio::spawn(async move {
        api_utils::monitor_transactions_manager::start(ctx_bg2).await;
    });

    tracing::info!("Starting payment-server on {}:{}", bind_address, port);
    let cors_cfg = cfg.clone();
    HttpServer::new(move || {
        App::new()
            .wrap(build_cors(&cors_cfg))
            .app_data(web::Data::new(ctx.clone()))
            .configure(api::configure_routes)
    })
    .bind((bind_address.as_str(), port))?
    .run()
    .await?;
    Ok(())
}
