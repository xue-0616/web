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
    #[serde(default)]
    pub with_openapi: bool,
    #[serde(default)]
    pub log_output_format: String,
    /// SECURITY (M-1): Allowed CORS origins (comma-separated). Defaults to restrictive.
    #[serde(default)]
    pub cors_allowed_origins: String,
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
