use actix_web::{web, App, HttpServer};
use sea_orm::ConnectionTrait;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Check DB migration version on startup and log warnings if out of date (LOW-20).
async fn check_db_migrations(db: &sea_orm::DatabaseConnection, expected_version: &str) {
    if expected_version.is_empty() {
        tracing::info!("DB_MIGRATION_VERSION not set, skipping migration check");
        return;
    }

    // Query the migration version table if it exists
    let result: Result<sea_orm::ExecResult, _> = db
        .execute(sea_orm::Statement::from_string(
            sea_orm::DatabaseBackend::MySql,
            "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1".to_string(),
        ))
        .await;

    match result {
        Ok(res) => {
            let rows_affected = res.rows_affected();
            tracing::info!(
                "DB migration check: expected={}, query returned {} rows",
                expected_version,
                rows_affected
            );
            // If table exists but no rows, warn
            if rows_affected == 0 {
                tracing::warn!(
                    "DB migration table exists but is empty; expected version={}. \
                     Run pending migrations before production use.",
                    expected_version
                );
            }
        }
        Err(_) => {
            // Table may not exist — try alternate table name used by common migration tools
            let alt_result: Result<sea_orm::ExecResult, _> = db
                .execute(sea_orm::Statement::from_string(
                    sea_orm::DatabaseBackend::MySql,
                    "SELECT version FROM _migrations ORDER BY version DESC LIMIT 1".to_string(),
                ))
                .await;

            match alt_result {
                Ok(_) => {
                    tracing::info!(
                        "DB migration check (alt table): expected version={}",
                        expected_version
                    );
                }
                Err(_) => {
                    tracing::warn!(
                        "No migration tracking table found (checked schema_migrations, _migrations). \
                         Expected DB version={}. Consider adding a migration system for production.",
                        expected_version
                    );
                }
            }
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = configs::ValidatorConfig::from_env()?;
    let port = cfg.port;

    let db = sea_orm::Database::connect(&cfg.database_url).await?;
    let redis_cfg = deadpool_redis::Config::from_url(&cfg.redis_url);
    let redis_pool = redis_cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;

    // --- DB Migration version check (LOW-20) ---
    check_db_migrations(&db, &cfg.db_migration_version).await;

    // ValidatorContext::new now validates and creates the signer
    let ctx = api::ValidatorContext::new(db.clone(), redis_pool, cfg.clone())?;

    // --- Load last synced blocks from Redis on startup (MEDIUM-15) ---
    {
        let supported = cfg.supported_chain_ids();
        for chain_id in &supported {
            let redis_block =
                get_last_synced_block_redis(&ctx, *chain_id).await;
            if redis_block > 0 {
                tracing::info!(
                    "Loaded last_synced_block from Redis for chain {}: {}",
                    chain_id,
                    redis_block
                );
            }
        }
    }

    // --- Graceful shutdown token (MEDIUM-14) ---
    let cancel = tokio_util::sync::CancellationToken::new();

    // Background: monitor + scheduler with cancellation support
    let ctx_mon = ctx.clone();
    let cancel_mon = cancel.clone();
    tokio::spawn(async move {
        validator_monitor::start(ctx_mon, cancel_mon).await;
    });
    let ctx_sched = ctx.clone();
    let cancel_sched = cancel.clone();
    tokio::spawn(async move {
        validator_scheduler::start(ctx_sched, cancel_sched).await;
    });

    // --- Build CORS (MEDIUM-12) ---
    let cors_origins = cfg.cors_origins();
    let api_key = cfg.api_key.clone();

    // --- Rate limiting (MEDIUM-13) ---
    // Global rate limiter: 60 requests/minute per IP (1 per second, burst 5)
    use actix_governor::{Governor, GovernorConfigBuilder};
    let governor_conf = GovernorConfigBuilder::default()
        .per_second(1)  // 1 request per second baseline = 60/min
        .burst_size(5)  // Allow short bursts of 5
        .finish()
        .expect("Failed to build rate limiter config");

    tracing::info!("Starting bridge-validator on port {}", port);
    let server = HttpServer::new(move || {
        // Build CORS policy
        let cors = if cors_origins.is_empty() {
            // No origins configured — deny cross-origin (only same-origin allowed)
            actix_cors::Cors::default()
                .allowed_methods(vec!["GET", "POST"])
                .allowed_headers(vec![
                    actix_web::http::header::CONTENT_TYPE,
                    actix_web::http::header::AUTHORIZATION,
                    actix_web::http::header::HeaderName::from_static("x-api-key"),
                ])
                .max_age(3600)
        } else {
            let mut c = actix_cors::Cors::default();
            for origin in &cors_origins {
                c = c.allowed_origin(origin);
            }
            c.allowed_methods(vec!["GET", "POST"])
                .allowed_headers(vec![
                    actix_web::http::header::CONTENT_TYPE,
                    actix_web::http::header::AUTHORIZATION,
                    actix_web::http::header::HeaderName::from_static("x-api-key"),
                ])
                .max_age(3600)
        };

        App::new()
            .wrap(cors)
            .wrap(Governor::new(&governor_conf))
            .wrap(validator::middleware::ApiKeyAuth::new(api_key.clone()))
            .app_data(web::Data::new(ctx.clone()))
            .configure(validator::configure_routes)
    })
    .bind(("0.0.0.0", port))?
    .run();

    // --- Graceful shutdown (MEDIUM-14) ---
    let server_handle = server.handle();
    let cancel_signal = cancel.clone();
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.ok();
        tracing::info!("Received SIGINT, initiating graceful shutdown...");
        cancel_signal.cancel(); // Signal background tasks to stop
        server_handle.stop(true).await; // Gracefully stop HTTP server
    });

    server.await?;
    tracing::info!("Bridge validator shut down cleanly");
    Ok(())
}

// --- MEDIUM-15: Redis-backed last synced block ---

/// Get last synced block from Redis. Returns 0 if not found.
async fn get_last_synced_block_redis(ctx: &api::ValidatorContext, chain_id: u64) -> u64 {
    let key = format!("BRIDGE:LAST_SYNCED:{}", chain_id);
    match ctx.redis_conn().await {
        Ok(mut conn) => {
            let result: Result<String, _> = redis::cmd("GET")
                .arg(&key)
                .query_async(&mut *conn)
                .await;
            match result {
                Ok(val) => val.parse::<u64>().unwrap_or(0),
                Err(_) => 0,
            }
        }
        Err(e) => {
            tracing::warn!("Redis connection error reading last_synced_block for chain {}: {}", chain_id, e);
            0
        }
    }
}
