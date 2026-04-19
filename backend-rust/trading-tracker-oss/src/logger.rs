//! Logger setup — matches the closed-source `logger::setup_logger` entry point
//! at `src/logger.rs:27` (one tracing event confirmed there).

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Initialise `tracing` with either JSON or pretty output, controlled by
/// `TRADING_TRACKER_LOG_OUTPUT_FORMAT` (or `RUST_LOG` for filter level).
pub fn setup_logger() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,tower=warn,hyper=warn,h2=warn"));

    let json_mode = std::env::var("TRADING_TRACKER_LOG_OUTPUT_FORMAT")
        .map(|v| v.eq_ignore_ascii_case("json"))
        .unwrap_or(true);

    // Line 27 in the original corresponds to a single `tracing::info!` call
    // emitted right after the subscriber is installed.
    if json_mode {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer().json().with_current_span(true).with_span_list(true))
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer().with_target(true))
            .init();
    }
    tracing::info!(format = if json_mode { "json" } else { "pretty" }, "logger initialized");
}
