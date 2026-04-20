use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct EnvConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    #[serde(default)]
    pub ckb_rpc_url: String,
    #[serde(default)]
    pub ckb_indexer_url: String,
    #[serde(default)]
    pub slack_webhook: String,
    #[serde(default)]
    pub github_token: String,
    #[serde(default)]
    pub sequencer_utxo_global_api_key: String,
    /// SECURITY (M-2): JWT secret — validated at startup to be non-empty and ≥32 bytes
    pub jwt_secret: String,
    // `with_openapi` and `log_output_format` are env-var surface
    // that operators already set in `.env.integration`; neither is
    // read by the current startup path, but we keep them on the
    // struct so envy::from_env doesn't reject a "real" env file as
    // malformed. Wire them into the logger config + route builder
    // in a future PR.
    #[serde(default)]
    #[allow(dead_code)]
    pub with_openapi: bool,
    #[serde(default)]
    #[allow(dead_code)]
    pub log_output_format: String,
    /// SECURITY (M-1): Allowed CORS origins (comma-separated). Defaults to restrictive.
    #[serde(default)]
    pub cors_allowed_origins: String,

    // -------- MED-SW-2: on-chain deployment config -------------
    // The `/api/v1/configurations` endpoint used to return empty
    // strings for every field because there was nowhere to source
    // them from. We surface them through the env so operators can
    // point the frontend at the right deployment without code
    // changes. `#[serde(default)]` keeps dev boots working with a
    // minimal env file; when the endpoint is actually called with
    // an unset value, the handler returns 503 rather than a
    // cheerful-but-wrong empty hash.
    #[serde(default)]
    pub sequencer_lock_code_hash: String,
    #[serde(default = "default_lock_hash_type")]
    pub sequencer_lock_hash_type: u8,
    #[serde(default)]
    pub sequencer_lock_args: String,
    #[serde(default)]
    pub pool_type_code_hash: String,
    #[serde(default)]
    pub configs_cell_type_hash: String,
    #[serde(default)]
    pub deployment_cell_type_hash: String,
    /// Fee in basis points (30 = 0.30%). Surfaced via /configurations
    /// so the frontend fee preview cannot drift from the sequencer.
    #[serde(default = "default_fee_bps")]
    pub swap_fee_bps: u16,
    /// Minimum liquidity units kept locked in a pool forever (first-
    /// LP lockup). Surfaced for UI parity with the batcher.
    #[serde(default = "default_min_liquidity")]
    pub min_liquidity: String,
    /// How many intents the batcher will include per tx. Advisory,
    /// exposed for UI queue-depth hints.
    #[serde(default = "default_max_intents")]
    pub max_intents_per_batch: u32,
    /// How often the batcher runs (milliseconds). Advisory.
    #[serde(default = "default_batch_interval_ms")]
    pub batch_interval_ms: u32,
}

fn default_lock_hash_type() -> u8 {
    1
}
fn default_fee_bps() -> u16 {
    30
}
fn default_min_liquidity() -> String {
    "1000".to_string()
}
fn default_max_intents() -> u32 {
    50
}
fn default_batch_interval_ms() -> u32 {
    3_000
}

fn default_port() -> u16 {
    8080
}

impl EnvConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let config = envy::from_env::<EnvConfig>()?;

        // SECURITY (M-2): Validate JWT secret at startup
        if config.jwt_secret.is_empty() {
            anyhow::bail!(
                "JWT_SECRET environment variable is not set or empty. \
                 A secure random string of at least 32 bytes is required."
            );
        }
        if config.jwt_secret.len() < 32 {
            anyhow::bail!(
                "JWT_SECRET is too short ({} bytes). Must be at least 32 bytes for security.",
                config.jwt_secret.len()
            );
        }

        Ok(config)
    }
}
