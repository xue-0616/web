use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_bind_address")]
    pub bind_address: String,
    #[serde(default = "default_workers")]
    pub worker_count: usize,
    #[serde(default)]
    pub log_level: String,

    /// API key for endpoint authentication (required — no default).
    /// Set via `TSS_API_KEY` environment variable.
    #[serde(alias = "tss_api_key")]
    pub api_key: String,

    /// Optional path for persistent key-share storage.
    /// When unset, key shares live only in-memory (lost on restart).
    #[serde(default)]
    pub key_store_path: Option<String>,

    /// Session timeout in seconds (default 300 = 5 min).
    #[serde(default = "default_session_timeout")]
    pub session_timeout_secs: u64,
}

fn default_port() -> u16 { 8083 }
fn default_bind_address() -> String { "127.0.0.1".to_string() }
fn default_workers() -> usize { 4 }
fn default_session_timeout() -> u64 { 300 }

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let cfg = envy::prefixed("TSS_").from_env::<Self>()
            .or_else(|_| envy::from_env::<Self>())?;
        cfg.validate()?;
        Ok(cfg)
    }

    fn validate(&self) -> anyhow::Result<()> {
        anyhow::ensure!(!self.api_key.is_empty(), "TSS_API_KEY must be set and non-empty");
        anyhow::ensure!(self.api_key.len() >= 16, "TSS_API_KEY must be at least 16 characters");
        Ok(())
    }
}
