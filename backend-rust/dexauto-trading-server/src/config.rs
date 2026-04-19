use serde::Deserialize;

/// Environment configuration.
/// NOTE: Debug is intentionally NOT derived to prevent accidental secret leakage in logs.
#[derive(Clone, Deserialize)]
pub struct EnvConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: String,
    #[serde(default)]
    pub dexauto_trading_node: String,  // local|dev|staging|testnet|mainnet
    #[serde(default)]
    pub secret_path: String,           // JSON config file path (AWS KMS keys)
    #[serde(default)]
    pub solana_rpc_url: String,
    #[serde(default)]
    pub jupiter_url: String,
    #[serde(default)]
    pub trading_tracker_url: String,
    #[serde(default)]
    pub tx_submitter_private_key: String,
    #[serde(default)]
    pub tx_submitter_api_key: String,
    #[serde(default)]
    pub slack_webhook: String,
    #[serde(default = "default_jito_region")]
    pub jito_region: String,
    #[serde(default)]
    pub jito_endpoint: String,
    #[serde(default)]
    pub helius_api_key: String,
    #[serde(default)]
    pub jupiter_api_key: String,
    #[serde(default)]
    pub with_openapi: bool,
    /// ShredStream proxy gRPC endpoint (local sidecar, e.g. http://127.0.0.1:9999)
    #[serde(default)]
    pub shredstream_endpoint: String,
    /// Staked RPC endpoint for SWQoS priority block inclusion (e.g. https://staked.helius-rpc.com)
    #[serde(default)]
    pub staked_rpc_url: String,

    // ── Security additions ──
    /// Required API key for all authenticated endpoints (env: API_AUTH_KEY)
    #[serde(default)]
    pub api_auth_key: String,
    /// Allowed CORS origin (env: CORS_ALLOWED_ORIGIN). Empty = restrictive default.
    #[serde(default)]
    pub cors_allowed_origin: String,
    /// Rate limit: max requests per 60-second window per IP (env: RATE_LIMIT_RPS, default 120)
    #[serde(default = "default_rate_limit")]
    pub rate_limit_rps: u32,
    /// Bind address for the HTTP server (env: BIND_ADDRESS, default "127.0.0.1").
    /// Set to "0.0.0.0" only if a reverse proxy or firewall is in front. (Audit #58)
    #[serde(default = "default_bind_address")]
    pub bind_address: String,
    /// Whether RPC fallback submissions skip preflight simulation (env: SKIP_PREFLIGHT, default true).
    /// Set to false for extra safety at the cost of latency. (Audit #43)
    #[serde(default = "default_skip_preflight")]
    pub skip_preflight: bool,
}

fn default_port() -> u16 { 8082 }
fn default_jito_region() -> String { "tokyo".to_string() }
fn default_rate_limit() -> u32 { 120 }
fn default_bind_address() -> String { "127.0.0.1".to_string() }
fn default_skip_preflight() -> bool { true }

/// SECRET_PATH JSON structure for AWS KMS.
/// NOTE: Debug is intentionally NOT derived to prevent accidental secret leakage in logs.
#[derive(Clone, Deserialize)]
pub struct SecretConfig {
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub key_id: String,
}

impl std::fmt::Debug for SecretConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SecretConfig")
            .field("region", &self.region)
            .field("access_key_id", &"[REDACTED]")
            .field("secret_access_key", &"[REDACTED]")
            .field("key_id", &"[REDACTED]")
            .finish()
    }
}

impl EnvConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let config = envy::from_env::<Self>()?;
        config.validate()?;
        Ok(config)
    }

    /// Validate that critical configuration values are not empty.
    /// Fails fast at startup rather than causing cryptic runtime errors.
    fn validate(&self) -> anyhow::Result<()> {
        if self.solana_rpc_url.is_empty() {
            anyhow::bail!("SOLANA_RPC_URL must be set");
        }
        if self.database_url.is_empty() {
            anyhow::bail!("DATABASE_URL must be set");
        }
        Ok(())
    }

    pub fn load_secret(&self) -> anyhow::Result<Option<SecretConfig>> {
        if self.secret_path.is_empty() {
            return Ok(None);
        }
        let data = std::fs::read_to_string(&self.secret_path)?;
        let secret: SecretConfig = serde_json::from_str(&data)?;
        Ok(Some(secret))
    }
}
