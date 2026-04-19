use anyhow::Context as _;

use apple_public_key_monitor_oss::{config::Config, runner};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // JSON logs if `LOG_OUTPUT_FORMAT=json`, pretty otherwise. Matches the
    // convention used by the other rewritten services in this repo.
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    if std::env::var("LOG_OUTPUT_FORMAT").as_deref() == Ok("json") {
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .json()
            .init();
    } else {
        tracing_subscriber::fmt().with_env_filter(env_filter).init();
    }

    let cfg = Config::from_env().context("failed to load configuration")?;
    tracing::info!(
        apple_keys_url = %cfg.apple_keys_url,
        poll_interval_secs = cfg.poll_interval.as_secs(),
        state_file = %cfg.state_file.display(),
        "starting apple-public-key-monitor",
    );

    let client = reqwest::Client::builder()
        .user_agent(concat!(
            "apple-public-key-monitor-oss/",
            env!("CARGO_PKG_VERSION")
        ))
        .build()
        .context("build http client")?;

    // Signal-driven shutdown so k8s SIGTERM is honoured promptly.
    let (tx, rx) = tokio::sync::oneshot::channel();
    tokio::spawn(async move {
        let mut sigterm = match tokio::signal::unix::signal(
            tokio::signal::unix::SignalKind::terminate(),
        ) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(error = %e, "SIGTERM handler unavailable — Ctrl-C only");
                // Fall back to Ctrl-C below.
                tokio::signal::ctrl_c().await.ok();
                let _ = tx.send(());
                return;
            }
        };
        tokio::select! {
            _ = sigterm.recv() => tracing::info!("SIGTERM received"),
            _ = tokio::signal::ctrl_c() => tracing::info!("SIGINT received"),
        }
        let _ = tx.send(());
    });

    runner::run(cfg, client, rx).await
}
