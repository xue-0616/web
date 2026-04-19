use std::sync::Arc;
use std::time::Duration;

use anyhow::Context as _;

use dkim_and_open_id_monitor_oss::{config::Config, logger};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let cfg = Arc::new(Config::from_env().context("load config")?);
    logger::init(cfg.log_json);

    tracing::info!(
        oidc = cfg.open_id_providers.len(),
        dkim = cfg.dkim_targets.len(),
        "dkim-and-open-id-monitor starting"
    );

    let _client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .context("build reqwest client")?;

    // TODO(oss): full orchestration loop is left for deployment-specific
    // wiring — each operator plugs in their preferred ChainLogReader
    // (ethers / alloy / self-hosted indexer) and DkimResolver
    // (trust-dns / system-resolver). The library pieces in
    // `src/jwks.rs`, `src/dkim_dns.rs`, `src/chain_log.rs`,
    // `src/reconciler.rs` and `src/slack.rs` compose straightforwardly:
    //
    //   for provider in &cfg.open_id_providers {
    //       let set  = jwks::fetch(&client, &provider.certs_url).await?;
    //       let live = jwks::fingerprint_rsa_set(&set);
    //       let live_map: BTreeMap<_,_> = live.iter()
    //           .map(|f| (format!("{}|{}", provider.iss, f.kid), f.fingerprint.clone()))
    //           .collect();
    //       let entries = chain_reader.logs_up_to(LogKind::OpenId, latest).await?;
    //       let chain_map = chain_log::current_set(&entries);
    //       let report = reconciler::reconcile(&live_map, &chain_map);
    //       slack::notify(&client, &cfg.slack_webhook_url, provider.iss.as_str(), &report).await?;
    //   }
    //
    //   and the analogous loop over dkim_targets using dkim_dns::fetch_one.

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

    tracing::info!("shutdown complete");
    Ok(())
}
