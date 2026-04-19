use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// JSON-RPC server bind address.
    #[serde(default = "default_bind")]
    pub bind: String,
    #[serde(default = "default_port")]
    pub port: u16,

    /// redb database file path.
    pub db_path: String,

    pub ckb: CkbConfig,
    pub btc: BtcConfig,

    /// Block we start indexing from on a cold database.
    #[serde(default)]
    pub ckb_from_block: u64,
    #[serde(default)]
    pub btc_from_block: u64,

    #[serde(default = "default_poll_interval")]
    pub poll_interval_secs: u64,

    #[serde(default)]
    pub log_json: bool,
}

fn default_bind() -> String { "0.0.0.0".into() }
fn default_port() -> u16 { 8114 }
fn default_poll_interval() -> u64 { 5 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CkbConfig {
    pub rpc_url: String,
    /// Network prefix — `ckb` for mainnet, `ckt` for testnet.
    #[serde(default = "default_ckb_prefix")]
    pub address_prefix: String,
}
fn default_ckb_prefix() -> String { "ckb".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BtcConfig {
    pub rpc_url: String,
    #[serde(default)]
    pub rpc_user: Option<String>,
    #[serde(default)]
    pub rpc_password: Option<String>,
    #[serde(default = "default_btc_network")]
    pub network: String,
}
fn default_btc_network() -> String { "mainnet".into() }

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("missing env var: {0}")]
    MissingVar(&'static str),
    #[error("read {path}: {source}")]
    Io { path: std::path::PathBuf, source: std::io::Error },
    #[error("parse: {0}")]
    Parse(String),
    #[error("validation: {0}")]
    Validation(String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let path = std::env::var("CONFIG_PATH").map_err(|_| ConfigError::MissingVar("CONFIG_PATH"))?;
        Self::from_path(Path::new(&path))
    }
    pub fn from_path(path: &Path) -> Result<Self, ConfigError> {
        let body = fs::read(path).map_err(|e| ConfigError::Io {
            path: path.to_path_buf(),
            source: e,
        })?;
        let cfg: Self = serde_json::from_slice(&body)
            .map_err(|e| ConfigError::Parse(e.to_string()))?;
        cfg.validate()?;
        Ok(cfg)
    }
    pub fn validate(&self) -> Result<(), ConfigError> {
        if self.db_path.is_empty() {
            return Err(ConfigError::Validation("db_path must be non-empty".into()));
        }
        if !self.ckb.rpc_url.starts_with("http") {
            return Err(ConfigError::Validation("ckb.rpc_url must be http(s)".into()));
        }
        if !self.btc.rpc_url.starts_with("http") {
            return Err(ConfigError::Validation("btc.rpc_url must be http(s)".into()));
        }
        match self.ckb.address_prefix.as_str() {
            "ckb" | "ckt" => {}
            other => return Err(ConfigError::Validation(format!(
                "ckb.address_prefix must be 'ckb' or 'ckt', got {other:?}"
            ))),
        }
        match self.btc.network.as_str() {
            "mainnet" | "testnet" | "regtest" | "signet" => {}
            other => return Err(ConfigError::Validation(format!(
                "btc.network unsupported: {other:?}"
            ))),
        }
        if self.poll_interval_secs == 0 {
            return Err(ConfigError::Validation("poll_interval_secs must be >= 1".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
        "bind": "127.0.0.1",
        "port": 9000,
        "db_path": "./rgbpp.redb",
        "ckb": {"rpc_url": "https://ckb.example.com", "address_prefix": "ckt"},
        "btc": {"rpc_url": "https://btc.example.com", "network": "testnet"},
        "ckb_from_block": 1,
        "btc_from_block": 2
    }"#;

    #[test]
    fn parses_sample_with_defaults() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(cfg.port, 9000);
        assert_eq!(cfg.ckb.address_prefix, "ckt");
        assert_eq!(cfg.poll_interval_secs, 5);
        cfg.validate().unwrap();
    }

    #[test]
    fn default_prefix_is_ckb_mainnet() {
        let src = r#"{
            "db_path":"./x.redb",
            "ckb": {"rpc_url": "https://c"},
            "btc": {"rpc_url": "https://b"}
        }"#;
        let cfg: Config = serde_json::from_str(src).unwrap();
        assert_eq!(cfg.ckb.address_prefix, "ckb");
        assert_eq!(cfg.btc.network, "mainnet");
        cfg.validate().unwrap();
    }

    #[test]
    fn rejects_empty_db_path() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.db_path = "".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_non_http_ckb_rpc() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.ckb.rpc_url = "tcp://bad".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_unknown_prefix() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.ckb.address_prefix = "xyz".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_unknown_btc_network() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.btc.network = "xyz".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_zero_poll() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.poll_interval_secs = 0;
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn loads_from_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), SAMPLE).unwrap();
        let cfg = Config::from_path(tmp.path()).unwrap();
        assert_eq!(cfg.btc.network, "testnet");
    }

    #[test]
    fn missing_file_is_io_error() {
        assert!(matches!(
            Config::from_path(Path::new("/nonexistent.json")),
            Err(ConfigError::Io { .. })
        ));
    }
}
