//! Logger bootstrap.
//!
//! Mirrors the closed-source ELF's `logger` crate: reads two booleans from
//! config (`log_output_to_cli`, `log_json_format`) and swaps the
//! tracing-subscriber format accordingly.

pub fn init(json: bool) {
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    if json {
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .json()
            .init();
    } else {
        tracing_subscriber::fmt().with_env_filter(env_filter).init();
    }
}
