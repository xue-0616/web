use serde::Deserialize;

/// Bridge validator configuration — loaded from environment variables.
/// Security-critical fields are validated on startup.
#[derive(Debug, Clone, Deserialize)]
pub struct ValidatorConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    #[serde(default)]
    pub secret_path: String,
    #[serde(default)]
    pub apollo_url: String,
    #[serde(default)]
    pub arbitrum_rpc_url: String,
    #[serde(default)]
    pub polygon_rpc_url: String,
    #[serde(default)]
    pub bsc_rpc_url: String,
    #[serde(default)]
    pub ethereum_rpc_url: String,
    #[serde(default)]
    pub validator_private_key: String,
    #[serde(default)]
    pub slack_webhook: String,

    // --- Security additions ---

    /// API key required for all endpoints (except /health). Checked via X-API-Key header.
    #[serde(default)]
    pub api_key: String,

    /// Comma-separated list of allowed CORS origins. Empty = deny all non-same-origin.
    #[serde(default)]
    pub cors_allowed_origins: String,

    /// Comma-separated list of supported chain IDs (e.g. "1,42161,137,56")
    #[serde(default)]
    pub supported_chains: String,

    /// Comma-separated list of whitelisted token contract addresses (lowercase hex with 0x prefix)
    #[serde(default)]
    pub token_whitelist: String,

    /// Comma-separated list of authorized validator ETH addresses (hex, for multisig threshold).
    /// REQUIRED — no default. Must be set via VALIDATOR_SET env var.
    pub validator_set: String,

    /// Number of validator signatures required to approve a bridge transfer.
    /// REQUIRED — no default. Must be set via THRESHOLD env var (e.g., 3 for 3-of-5).
    pub threshold: u32,

    /// Gas price multiplier (percentage, e.g. 120 = 1.2x). Applied to estimated gas price.
    #[serde(default = "default_gas_multiplier")]
    pub gas_price_multiplier: u64,

    /// Maximum gas price in gwei. Transactions above this are rejected.
    #[serde(default = "default_max_gas_gwei")]
    pub max_gas_price_gwei: u64,

    /// HMAC secret for webhook signature verification
    #[serde(default)]
    pub webhook_secret: String,

    /// Maximum single transfer amount in wei (string for large numbers)
    #[serde(default)]
    pub max_transfer_amount: String,

    /// Expected DB migration version. Startup aborts if DB version doesn't match.
    #[serde(default)]
    pub db_migration_version: String,

    /// Required block confirmations for Ethereum mainnet
    #[serde(default = "default_eth_confirmations")]
    pub eth_confirmations: u64,

    /// Required block confirmations for Arbitrum
    #[serde(default = "default_arb_confirmations")]
    pub arb_confirmations: u64,

    /// Required block confirmations for Polygon
    #[serde(default = "default_polygon_confirmations")]
    pub polygon_confirmations: u64,

    /// Required block confirmations for BSC
    #[serde(default = "default_bsc_confirmations")]
    pub bsc_confirmations: u64,
}

fn default_port() -> u16 {
    8086
}
fn default_gas_multiplier() -> u64 {
    120
}
fn default_max_gas_gwei() -> u64 {
    500
}
fn default_eth_confirmations() -> u64 {
    12
}
fn default_arb_confirmations() -> u64 {
    15
}
fn default_polygon_confirmations() -> u64 {
    64
}
fn default_bsc_confirmations() -> u64 {
    15
}

impl ValidatorConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let cfg = envy::from_env::<Self>()?;
        cfg.validate_startup()?;
        Ok(cfg)
    }

    /// Validate critical configuration on startup. Fail-closed: abort if anything is wrong.
    fn validate_startup(&self) -> anyhow::Result<()> {
        // Validate private key: must be present and valid 32-byte hex
        if self.validator_private_key.is_empty() {
            anyhow::bail!("VALIDATOR_PRIVATE_KEY is required but not set");
        }
        let key_hex = self.validator_private_key.trim_start_matches("0x");
        if key_hex.len() != 64 || !key_hex.chars().all(|c| c.is_ascii_hexdigit()) {
            anyhow::bail!("VALIDATOR_PRIVATE_KEY must be a 32-byte hex string (64 hex chars)");
        }
        // NEVER log the key — only log that it was loaded
        tracing::info!("Validator private key loaded (source: environment variable)");
        tracing::warn!(
            "Private key loaded from environment variable. \
             Consider using a KMS (AWS KMS, HashiCorp Vault) for production deployments."
        );

        // Validate API key
        if self.api_key.is_empty() {
            tracing::warn!("API_KEY is not set — API endpoints will reject all requests!");
        }

        // Validate multisig validator set
        let validators = self.validator_set_addresses();
        if validators.is_empty() {
            anyhow::bail!(
                "VALIDATOR_SET must contain at least one validator address (comma-separated hex)"
            );
        }
        for addr in &validators {
            let clean = addr.trim_start_matches("0x");
            if clean.len() != 40 || !clean.chars().all(|c| c.is_ascii_hexdigit()) {
                anyhow::bail!(
                    "Invalid validator address in VALIDATOR_SET: '{}' (must be 20-byte hex)",
                    addr
                );
            }
        }
        if self.threshold == 0 {
            anyhow::bail!("THRESHOLD must be > 0");
        }
        if self.threshold as usize > validators.len() {
            anyhow::bail!(
                "THRESHOLD ({}) exceeds number of validators ({}) — impossible to reach consensus",
                self.threshold,
                validators.len()
            );
        }
        tracing::info!(
            "Multisig config: threshold={}/{}, validators={:?}",
            self.threshold,
            validators.len(),
            validators
        );

        // Validate supported chains
        if self.supported_chains.is_empty() {
            anyhow::bail!("SUPPORTED_CHAINS must be set (e.g. '1,42161,137,56')");
        }

        // Validate at least one RPC URL
        if self.ethereum_rpc_url.is_empty()
            && self.arbitrum_rpc_url.is_empty()
            && self.polygon_rpc_url.is_empty()
            && self.bsc_rpc_url.is_empty()
        {
            anyhow::bail!("At least one chain RPC URL must be configured");
        }

        Ok(())
    }

    /// Parse supported chain IDs from comma-separated config string.
    pub fn supported_chain_ids(&self) -> Vec<u64> {
        self.supported_chains
            .split(',')
            .filter_map(|s| s.trim().parse::<u64>().ok())
            .collect()
    }

    /// Parse token whitelist from comma-separated config string. Returns lowercase addresses.
    pub fn token_whitelist_set(&self) -> Vec<String> {
        self.token_whitelist
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect()
    }

    /// Parse validator set addresses from comma-separated config string. Returns lowercase.
    pub fn validator_set_addresses(&self) -> Vec<String> {
        self.validator_set
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect()
    }

    /// Parse CORS allowed origins.
    pub fn cors_origins(&self) -> Vec<String> {
        self.cors_allowed_origins
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }

    /// Get RPC URL for a given chain ID. Returns None for unsupported chains.
    pub fn rpc_url_for_chain(&self, chain_id: u64) -> Option<&str> {
        match chain_id {
            1 => {
                if self.ethereum_rpc_url.is_empty() {
                    None
                } else {
                    Some(&self.ethereum_rpc_url)
                }
            }
            42161 => {
                if self.arbitrum_rpc_url.is_empty() {
                    None
                } else {
                    Some(&self.arbitrum_rpc_url)
                }
            }
            137 => {
                if self.polygon_rpc_url.is_empty() {
                    None
                } else {
                    Some(&self.polygon_rpc_url)
                }
            }
            56 => {
                if self.bsc_rpc_url.is_empty() {
                    None
                } else {
                    Some(&self.bsc_rpc_url)
                }
            }
            _ => None,
        }
    }

    /// Get required confirmations for a given chain ID.
    pub fn confirmations_for_chain(&self, chain_id: u64) -> u64 {
        match chain_id {
            1 => self.eth_confirmations,
            42161 => self.arb_confirmations,
            137 => self.polygon_confirmations,
            56 => self.bsc_confirmations,
            _ => 20, // Conservative default for unknown chains
        }
    }
}
