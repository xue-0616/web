use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use sea_orm::Database;
use tracing_actix_web::TracingLogger;

mod config;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .json()
        .init();

    let config = config::EnvConfig::from_env()?;

    // SECURITY (L-24): Verify migration integrity before starting
    if let Err(e) = migration::verify_migration_count() {
        tracing::error!("Migration verification failed: {}", e);
        anyhow::bail!("Migration verification failed: {}", e);
    }

    // Database connection
    let db = Database::connect(&config.database_url).await?;
    tracing::info!("Database connected");

    // Redis connection
    let redis_cfg = deadpool_redis::Config::from_url(&config.redis_url);
    let redis_pool = redis_cfg
        .create_pool(Some(deadpool_redis::Runtime::Tokio1))
        .expect("Failed to create Redis pool");
    tracing::info!("Redis pool created");

    // Build app state
    let app_state = api_common::context::AppContext {
        db: db.clone(),
        redis: redis_pool.clone(),
        config: api_common::context::EnvConfigRef {
            ckb_rpc_url: config.ckb_rpc_url.clone(),
            ckb_indexer_url: config.ckb_indexer_url.clone(),
            jwt_secret: config.jwt_secret.clone(),
            sequencer_utxo_global_api_key: config.sequencer_utxo_global_api_key.clone(),
            slack_webhook: config.slack_webhook.clone(),
            github_token: config.github_token.clone(),
            // MED-SW-2
            sequencer_lock_code_hash: config.sequencer_lock_code_hash.clone(),
            sequencer_lock_hash_type: config.sequencer_lock_hash_type,
            sequencer_lock_args: config.sequencer_lock_args.clone(),
            pool_type_code_hash: config.pool_type_code_hash.clone(),
            configs_cell_type_hash: config.configs_cell_type_hash.clone(),
            deployment_cell_type_hash: config.deployment_cell_type_hash.clone(),
            swap_fee_bps: config.swap_fee_bps,
            min_liquidity: config.min_liquidity.clone(),
            max_intents_per_batch: config.max_intents_per_batch,
            batch_interval_ms: config.batch_interval_ms,
        },
    };

    // Start background tasks
    let utils_state = app_state.clone();
    tokio::spawn(async move {
        if let Err(e) = utils::tokens_manager::manager::start(utils_state.clone()).await {
            tracing::error!("Tokens manager error: {}", e);
        }
    });

    let liquidity_state = app_state.clone();
    tokio::spawn(async move {
        if let Err(e) = utils::liquidity_pairs::manager::start(liquidity_state.clone()).await {
            tracing::error!("Liquidity pairs manager error: {}", e);
        }
    });

    let tasks_state = app_state.clone();
    tokio::spawn(async move {
        if let Err(e) = utils::tasks_manager::manager::start(tasks_state.clone()).await {
            tracing::error!("Tasks manager error: {}", e);
        }
    });

    // HTTP server
    let bind_addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Starting server on {}", bind_addr);

    let cors_origins = config.cors_allowed_origins.clone();

    HttpServer::new(move || {
        // SECURITY (M-1): Restrict CORS to configured origins instead of allow_any_origin
        let cors = if cors_origins.is_empty() {
            // Default: restrictive CORS — only allow same-origin
            tracing::warn!("CORS_ALLOWED_ORIGINS not set, using restrictive default");
            Cors::default()
                .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                .allowed_headers(vec![
                    actix_web::http::header::AUTHORIZATION,
                    actix_web::http::header::CONTENT_TYPE,
                    actix_web::http::header::ACCEPT,
                ])
                .max_age(3600)
        } else {
            let mut cors_builder = Cors::default()
                .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                .allowed_headers(vec![
                    actix_web::http::header::AUTHORIZATION,
                    actix_web::http::header::CONTENT_TYPE,
                    actix_web::http::header::ACCEPT,
                ])
                .max_age(3600);
            for origin in cors_origins.split(',') {
                let trimmed = origin.trim();
                if !trimmed.is_empty() {
                    cors_builder = cors_builder.allowed_origin(trimmed);
                }
            }
            cors_builder
        };

        App::new()
            .wrap(TracingLogger::default())
            .wrap(cors)
            .app_data(web::Data::new(app_state.clone()))
            .configure(api::configure_routes)
    })
    .bind(&bind_addr)?
    .run()
    .await?;

    Ok(())
}
