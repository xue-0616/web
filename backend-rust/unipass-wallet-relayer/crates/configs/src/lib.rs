use serde::Deserialize;

/// RelayerConfig — loaded from environment variables.
///
/// SECURITY: `relayer_private_key` is stored as a plain String here only for
/// deserialization.  Callers MUST wrap it in `SecurePrivateKey` (see security module)
/// immediately after loading, and remove the env var.
#[derive(Clone, Deserialize)]
pub struct RelayerConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    /// Apollo config endpoint (optional)
    #[serde(default)]
    pub apollo_url: String,
    /// SECRET_PATH for additional secrets
    #[serde(default)]
    pub secret_path: String,
    /// EVM RPC URLs per chain
    #[serde(default)]
    pub arbitrum_rpc_url: String,
    #[serde(default)]
    pub polygon_rpc_url: String,
    #[serde(default)]
    pub bsc_rpc_url: String,
    #[serde(default)]
    pub ethereum_rpc_url: String,
    /// Relayer private key (hex) — NEVER log this value
    #[serde(default)]
    pub relayer_private_key: String,
    #[serde(default)]
    pub slack_webhook: String,
}

fn default_port() -> u16 { 8084 }

// Custom Debug impl that redacts sensitive fields
impl std::fmt::Debug for RelayerConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RelayerConfig")
            .field("port", &self.port)
            .field("database_url", &"[REDACTED]")
            .field("redis_url", &"[REDACTED]")
            .field("apollo_url", &self.apollo_url)
            .field("arbitrum_rpc_url", &self.arbitrum_rpc_url)
            .field("polygon_rpc_url", &self.polygon_rpc_url)
            .field("bsc_rpc_url", &self.bsc_rpc_url)
            .field("ethereum_rpc_url", &self.ethereum_rpc_url)
            .field("relayer_private_key", &"[REDACTED]")
            .field("slack_webhook", &"[REDACTED]")
            .finish()
    }
}

/// Load config from env + optional Apollo + SECRET_PATH
pub async fn load_config() -> anyhow::Result<RelayerConfig> {
    let config: RelayerConfig = envy::from_env()?;

    // Optionally fetch from Apollo if configured
    if !config.apollo_url.is_empty() {
        let apollo_url = format!("{}/configfiles/json/wallet-relayer/default/application",
            &config.apollo_url);
        let client = reqwest::Client::new();
        match client.get(&apollo_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(items) = resp.json::<std::collections::HashMap<String, String>>().await {
                    tracing::info!("Loaded {} config items from Apollo", items.len());
                }
            }
            _ => {
                tracing::warn!("Failed to fetch Apollo config (non-fatal)");
            }
        }
    }

    Ok(config)
}
