//! `trading-tracker-oss` binary entry point.
//!
//! Reconstructed from reverse-engineering the closed-source
//! `backend-bin/trading-tracker/trading-tracker` ELF. See
//! `_snapshot/reconstruction/trading-tracker/_skeleton/HUMAN_GUIDE.md` for
//! the architectural narrative.

// Session 1 skeleton: many types and methods are declared but not yet wired
// into runtime paths. Full wiring lands in Sessions 2 (substreams stream)
// and 3 (DEX parsers). Suppress the 22 expected dead-code warnings until then.
#![allow(dead_code)]

use anyhow::Context as _;
use tracing::info;

use trading_tracker_oss::{
    config, cursor_store, logger, rpc, token_price_manager,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    logger::setup_logger();

    // 1. Load config (env-var first, fallback to TOML file).
    let cfg = config::TradingTrackerConfig::load()
        .context("failed to load TradingTrackerConfig")?;
    info!(endpoint = %cfg.node.endpoint, pools = cfg.pools.len(), "loaded config");

    // 2. Build the StreamingFast substreams endpoint.
    let endpoint = token_price_manager::substreams::SubstreamsEndpoint::new(
        cfg.node.endpoint.clone(),
        cfg.node.api_key.clone(),
    )
    .await
    .context("failed to connect to substreams endpoint")?;

    // 3. Open the durable cursor store (redb).
    let cursors = cursor_store::CursorStore::open(&cfg.db_path)
        .context("failed to open cursor store")?;
    let snap = cursors.load().unwrap_or_default();
    info!(
        cursor = snap.cursor.as_deref().unwrap_or("<none>"),
        last_block = snap.last_block,
        final_block_height = snap.final_block_height,
        "cursor store ready"
    );

    // 4. Start the token-price runner (background substreams consumer).
    // `TokenPriceRunner::new` already returns an `Arc<TokenPriceRunner>`.
    let runner = token_price_manager::runner::TokenPriceRunner::new(
        endpoint,
        cfg.node.clone(),
        cfg.start_block,
        cursors,
        cfg.pools.clone(),
    )
    .context("failed to init TokenPriceRunner")?;

    let bg = runner.clone();
    let substreams_task = tokio::spawn(async move {
        if let Err(e) = bg.deal_substream().await {
            tracing::error!(error = ?e, "substreams consumer exited with error");
        }
    });

    // 4. Start the jsonrpsee RPC server (foreground).
    let rpc_handle = rpc::serve(&cfg.rpc, runner.clone()).await?;
    info!(listen = %cfg.rpc.listen_addr, "JSON-RPC server started");

    // 5. Wait for either server stop or substreams error.
    tokio::select! {
        _ = rpc_handle.stopped() => info!("RPC server stopped"),
        _ = substreams_task => info!("substreams task exited"),
    }
    Ok(())
}
