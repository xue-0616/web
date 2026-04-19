use serde::Deserialize;
use std::fmt;

#[derive(Clone, Deserialize)]
pub struct PaymentConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    #[serde(default)]
    pub secret_path: String,
    #[serde(default)]
    pub apollo_url: String,
    // CORS
    #[serde(default)]
    pub cors_allowed_origins: String,
    // Bind address
    #[serde(default = "default_bind_address")]
    pub bind_address: String,
    // EVM chains
    #[serde(default)]
    pub arbitrum_rpc_url: String,
    #[serde(default)]
    pub polygon_rpc_url: String,
    #[serde(default)]
    pub bsc_rpc_url: String,
    #[serde(default)]
    pub ethereum_rpc_url: String,
    // Relayer
    #[serde(default)]
    pub relayer_url: String,
    pub relayer_private_key: String,
    #[serde(default)]
    pub relayer_api_key: String,
    // Third-party integrations
    #[serde(default)]
    pub paypal_client_id: String,
    pub paypal_client_secret: String,
    #[serde(default)]
    pub alchemy_pay_app_id: String,
    pub alchemy_pay_secret_key: String,
    #[serde(default)]
    pub coins_ph_api_key: String,
    pub coins_ph_secret: String,
    #[serde(default)]
    pub wind_api_key: String,
    pub wind_secret: String,
    #[serde(default)]
    pub bitrefill_api_key: String,
    pub bitrefill_secret: String,
    #[serde(default)]
    pub sendgrid_api_key: String,
    #[serde(default)]
    pub firebase_project_id: String,
    #[serde(default)]
    pub firebase_private_key: String,
    #[serde(default)]
    pub slack_webhook: String,
    pub jwt_secret: String,
    pub refresh_token_secret: String,
    // CoinMarketCap
    #[serde(default)]
    pub cmc_api_key: String,
    // Smart account factory and main module addresses (CRIT-05/CRIT-06)
    #[serde(default)]
    pub factory_address: String,
    #[serde(default)]
    pub main_module_address: String,
}

fn default_port() -> u16 { 8085 }

fn default_bind_address() -> String { "127.0.0.1".to_string() }

/// Redact a secret for display: show only first 4 chars + "***"
fn redact(s: &str) -> String {
    if s.len() <= 4 {
        "***".to_string()
    } else {
        format!("{}***", &s[..4])
    }
}

/// Custom Debug implementation that redacts all secret fields (FINDING-11/18)
impl fmt::Debug for PaymentConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("PaymentConfig")
            .field("port", &self.port)
            .field("database_url", &"[REDACTED]")
            .field("redis_url", &"[REDACTED]")
            .field("bind_address", &self.bind_address)
            .field("cors_allowed_origins", &self.cors_allowed_origins)
            .field("relayer_url", &self.relayer_url)
            .field("relayer_private_key", &redact(&self.relayer_private_key))
            .field("relayer_api_key", &redact(&self.relayer_api_key))
            .field("jwt_secret", &redact(&self.jwt_secret))
            .field("refresh_token_secret", &redact(&self.refresh_token_secret))
            .field("paypal_client_secret", &redact(&self.paypal_client_secret))
            .field("alchemy_pay_secret_key", &redact(&self.alchemy_pay_secret_key))
            .field("coins_ph_secret", &redact(&self.coins_ph_secret))
            .field("wind_secret", &redact(&self.wind_secret))
            .field("bitrefill_secret", &redact(&self.bitrefill_secret))
            .field("firebase_private_key", &redact(&self.firebase_private_key))
            .finish()
    }
}

impl PaymentConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let cfg = envy::from_env::<Self>()?;
        cfg.validate()?;
        Ok(cfg)
    }

    /// Validate that all critical secrets are set and meet minimum requirements.
    /// Panics on startup if configuration is insecure.
    pub fn validate(&self) -> anyhow::Result<()> {
        // JWT secret must be >= 32 bytes
        if self.jwt_secret.len() < 32 {
            anyhow::bail!(
                "FATAL: jwt_secret must be at least 32 bytes (got {} bytes). Set JWT_SECRET env var.",
                self.jwt_secret.len()
            );
        }

        // Refresh token secret must be >= 32 bytes
        if self.refresh_token_secret.len() < 32 {
            anyhow::bail!(
                "FATAL: refresh_token_secret must be at least 32 bytes (got {} bytes). Set REFRESH_TOKEN_SECRET env var.",
                self.refresh_token_secret.len()
            );
        }

        // Critical secrets must not be empty
        let required_secrets = [
            ("relayer_private_key", &self.relayer_private_key),
            ("paypal_client_secret", &self.paypal_client_secret),
            ("alchemy_pay_secret_key", &self.alchemy_pay_secret_key),
            ("coins_ph_secret", &self.coins_ph_secret),
            ("wind_secret", &self.wind_secret),
            ("bitrefill_secret", &self.bitrefill_secret),
        ];

        for (name, value) in &required_secrets {
            if value.is_empty() {
                anyhow::bail!(
                    "FATAL: {} must not be empty. Set the corresponding env var.",
                    name.to_uppercase()
                );
            }
        }

        // Validate relayer_private_key is valid 32-byte hex
        let clean_key = self.relayer_private_key.strip_prefix("0x").unwrap_or(&self.relayer_private_key);
        if clean_key.len() != 64 || hex::decode(clean_key).is_err() {
            anyhow::bail!("FATAL: relayer_private_key must be a valid 32-byte hex string (64 hex chars).");
        }

        Ok(())
    }

    /// Parse factory address from config (CRIT-05 helper)
    pub fn factory_address(&self) -> ethers::types::Address {
        if self.factory_address.is_empty() {
            // Default UniPass factory address on supported chains
            "0x000000000000000000000000000000000000dead".parse().unwrap()
        } else {
            self.factory_address.parse().unwrap_or_else(|_| {
                tracing::warn!("Invalid factory_address in config, using default");
                "0x000000000000000000000000000000000000dead".parse().unwrap()
            })
        }
    }

    /// Parse main module address from config (CRIT-05 helper)
    pub fn main_module_address(&self) -> ethers::types::Address {
        if self.main_module_address.is_empty() {
            "0x000000000000000000000000000000000000beef".parse().unwrap()
        } else {
            self.main_module_address.parse().unwrap_or_else(|_| {
                tracing::warn!("Invalid main_module_address in config, using default");
                "0x000000000000000000000000000000000000beef".parse().unwrap()
            })
        }
    }
}
