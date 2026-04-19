use actix_web::{web, App, HttpServer};
use sea_orm::Database;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use tokio::signal;

mod config;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::EnvConfig::from_env()?;
    let port = config.port;
    let bind_address = config.bind_address.clone();

    // --- Security: require API key at startup ---
    if config.api_auth_key.is_empty() {
        anyhow::bail!("API_AUTH_KEY environment variable must be set");
    }

    let db = Database::connect(&config.database_url).await?;
    tracing::info!("Database connected");

    let app_config = api_common::context::AppContextConfig {
        solana_rpc_url: config.solana_rpc_url.clone(),
        jupiter_url: config.jupiter_url.clone(),
        jupiter_api_key: config.jupiter_api_key.clone(),
        tx_submitter_private_key: config.tx_submitter_private_key.clone(),
        slack_webhook: config.slack_webhook.clone(),
    };

    // Background: tx submitter (Jito Bundle with tip tx + RPC fallback)
    let mut submitter_builder = if config.jito_endpoint.is_empty() {
        utils::tx_submitter::submitter::TxSubmitter::new(&config.solana_rpc_url, &config.jito_region)
    } else {
        utils::tx_submitter::submitter::TxSubmitter::with_jito_endpoint(&config.solana_rpc_url, &config.jito_endpoint)
    };

    // Configure staked RPC for SWQoS fallback
    if !config.staked_rpc_url.is_empty() {
        submitter_builder = submitter_builder.with_staked_rpc(&config.staked_rpc_url);
    }

    // Configure skip_preflight for RPC fallback (Audit #43)
    submitter_builder = submitter_builder.with_skip_preflight(config.skip_preflight);

    // Configure fee payer keypair for building Jito tip transactions
    if !config.tx_submitter_private_key.is_empty() {
        match bs58::decode(&config.tx_submitter_private_key).into_vec() {
            Ok(bytes) => {
                submitter_builder = submitter_builder.with_fee_payer(bytes);
                tracing::info!("Jito tip tx signing enabled (fee payer configured)");
            }
            Err(e) => {
                tracing::warn!("Failed to decode tx_submitter_private_key: {}, tip tx disabled", e);
            }
        }
    }

    let submitter = std::sync::Arc::new(submitter_builder);
    let (tx_sender, mut swap_receiver) =
        tokio::sync::mpsc::channel::<api_common::context::SwapJob>(256);

    // Convert SwapJob stream → PendingTransaction stream, then run through
    // the retry-aware `run_submitter_with_dead_letter` so sells escalate tips,
    // buys skip chasing after slippage, and errors are properly classified.
    let (pending_sender, pending_receiver) =
        tokio::sync::mpsc::channel::<utils::tx_submitter::pending_transaction::PendingTransaction>(256);

    tokio::spawn(async move {
        while let Some(job) = swap_receiver.recv().await {
            let kind = if job.is_sell {
                utils::tx_submitter::pending_transaction::OrderKind::Sell
            } else {
                utils::tx_submitter::pending_transaction::OrderKind::Buy
            };
            let pending = utils::tx_submitter::pending_transaction::PendingTransaction::new(
                &job.order_id, job.tx_bytes, job.is_anti_mev,
            )
            .with_tip(job.bribery_amount, job.consensus_votes)
            .with_order_kind(kind);

            if let Err(e) = pending_sender.send(pending).await {
                tracing::error!(
                    "Failed to forward SwapJob {} to tx_submitter: {}",
                    job.order_id, e,
                );
            }
        }
    });

    let submitter_for_runner = submitter.clone();
    tokio::spawn(async move {
        if let Err(e) = utils::tx_submitter::runner::run_submitter(
            submitter_for_runner, pending_receiver,
        ).await {
            tracing::error!("run_submitter exited with error: {}", e);
        }
    });

    let ctx = api_common::context::AppContext::new(db, app_config)
        .with_tx_sender(tx_sender);

    // --- Security: build restricted CORS ---
    let cors_origin = config.cors_allowed_origin.clone();
    let api_key_for_auth = config.api_auth_key.clone();
    let rate_limit_rps: u32 = config.rate_limit_rps;

    // Graceful shutdown: listen for SIGINT (Ctrl+C) and SIGTERM
    let server_handle = actix_web::rt::spawn(async {
        shutdown_signal().await;
    });

    tracing::info!("Starting trading-server on {}:{}", bind_address, port);
    let server = HttpServer::new(move || {
        // CORS: restrict to configured origin (default: deny browser cross-origin)
        let cors = if cors_origin.is_empty() {
            actix_cors::Cors::default()
                .allowed_methods(vec!["GET", "POST"])
                .allowed_headers(vec!["Content-Type", "X-API-Key", "X-User-Id", "Authorization"])
                .max_age(3600)
        } else {
            actix_cors::Cors::default()
                .allowed_origin(&cors_origin)
                .allowed_methods(vec!["GET", "POST"])
                .allowed_headers(vec!["Content-Type", "X-API-Key", "X-User-Id", "Authorization"])
                .max_age(3600)
        };

        // Rate limiter: per-IP sliding window
        let rate_limiter = api_common::security::RateLimiter::new(rate_limit_rps, 60);

        // API key auth middleware
        let api_key_auth = api_common::security::ApiKeyAuth::new(api_key_for_auth.clone());

        App::new()
            .wrap(cors)
            .wrap(rate_limiter)
            .app_data(web::Data::new(ctx.clone()))
            // Public health-check (no auth)
            .route("/api/v1/status", web::get().to(api::status::handler))
            // All other routes require auth
            .service(
                web::scope("/api/v1")
                    .wrap(api_key_auth)
                    .configure(api::configure_routes)
            )
    })
    .bind((&*bind_address, port))?
    .shutdown_timeout(30) // Allow up to 30s for in-flight requests to complete
    .run();

    // Run the server alongside the shutdown signal listener
    tokio::select! {
        result = server => {
            if let Err(e) = result {
                tracing::error!("Server error: {}", e);
            }
        }
        _ = server_handle => {
            tracing::info!("Shutdown signal received, server stopping gracefully...");
        }
    }

    tracing::info!("Server stopped");
    Ok(())
}

/// Wait for a shutdown signal (SIGINT or SIGTERM).
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => { tracing::info!("Received SIGINT (Ctrl+C)"); }
        _ = terminate => { tracing::info!("Received SIGTERM"); }
    }
}
