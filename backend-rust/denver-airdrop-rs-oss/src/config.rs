//! Config — JSON shape matches the original `denver-airdrop.json`.
//!
//! Field names recovered from the ELF's serde `FieldVisitor` switch
//! statement (see `upstream/_reconstructed/denver-airdrop-rs/src/config.rs`
//! for the raw Ghidra decompilation), lengths:
//!   * len 7  → `rpc_url`
//!   * len 9  → `stop_time` / `store_dir`
//!   * len 10 → `from_block`
//!   * len 11 → `nft_address` / `private_key`
//!   * and variable-length arrays keyed by `air_drop`.

use std::{fs, path::Path};

use ethers::types::Address;
use serde::{Deserialize, Serialize};

use crate::airdrop::AirDrop;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub rpc_url: String,
    pub private_key: String,

    /// The `ModuleMain` contract (emits `SetSource(address,address)` events).
    pub module_main_address: Address,
    /// The NFT contract whose `mint(address)` we call.
    pub nft_address: Address,

    /// First block we scan from on a cold start. Subsequent runs use
    /// the highest `deploy_block_number` in `store_dir`.
    pub from_block: u64,

    /// Polling cadence between `eth_getLogs` ticks.
    #[serde(default = "default_poll_interval")]
    pub poll_interval_secs: u64,

    /// Max blocks per `eth_getLogs` call (eth_getLogs rate-limit guard).
    #[serde(default = "default_block_step")]
    pub block_step: u64,

    /// Directory where per-source airdrop state is persisted (one JSON
    /// file per source contract, keyed by address). Recovered token:
    /// `store_dir`.
    pub store_dir: String,

    /// If set, the monitor exits once the chain's head crosses this
    /// block — used to cap denver-event campaigns. Recovered token:
    /// `stop_time` (ambiguously named but it's really a block number
    /// per the serde visit_u64 branch).
    #[serde(default)]
    pub stop_time: Option<u64>,

    /// Per-source-NFT-contract drop spec. Recovered key: `air_drop`.
    #[serde(default)]
    pub air_drop: Vec<AirDrop>,

    #[serde(default)]
    pub log_json: bool,
}

fn default_poll_interval() -> u64 { 15 }
fn default_block_step() -> u64 { 1000 }

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
        let path = std::env::var("CONFIG_PATH")
            .unwrap_or_else(|_| "./denver-airdrop.json".into());
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
        if !self.rpc_url.starts_with("http") {
            return Err(ConfigError::Validation(
                "rpc_url must be an http(s) URL".into(),
            ));
        }
        // Private key hex form: 32 bytes → 64 hex chars (optionally `0x`).
        let pk = self.private_key.trim_start_matches("0x");
        if pk.len() != 64 || !pk.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(ConfigError::Validation(
                "private_key must be 64 hex chars (optionally 0x-prefixed)".into(),
            ));
        }
        if self.poll_interval_secs == 0 {
            return Err(ConfigError::Validation(
                "poll_interval_secs must be >= 1".into(),
            ));
        }
        if self.block_step == 0 {
            return Err(ConfigError::Validation(
                "block_step must be >= 1".into(),
            ));
        }
        if self.store_dir.is_empty() {
            return Err(ConfigError::Validation("store_dir must be non-empty".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
        "rpc_url": "https://rpc.example.com",
        "private_key": "0x1111111111111111111111111111111111111111111111111111111111111111",
        "module_main_address": "0x0000000000000000000000000000000000000aaa",
        "nft_address": "0x0000000000000000000000000000000000000bbb",
        "from_block": 12345,
        "store_dir": "./state",
        "air_drop": []
    }"#;

    #[test]
    fn parses_sample_with_defaults() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(cfg.from_block, 12345);
        assert_eq!(cfg.poll_interval_secs, 15);
        assert_eq!(cfg.block_step, 1000);
        assert!(cfg.stop_time.is_none());
        cfg.validate().unwrap();
    }

    #[test]
    fn accepts_pk_without_0x_prefix() {
        let mut v: serde_json::Value = serde_json::from_str(SAMPLE).unwrap();
        v["private_key"] = serde_json::Value::String("1".repeat(64));
        let cfg: Config = serde_json::from_value(v).unwrap();
        cfg.validate().unwrap();
    }

    #[test]
    fn rejects_non_http_rpc() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.rpc_url = "ws://bad".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_short_private_key() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.private_key = "0xdeadbeef".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_non_hex_private_key() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.private_key = format!("0x{}", "z".repeat(64));
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_zero_poll_interval() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.poll_interval_secs = 0;
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_zero_block_step() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.block_step = 0;
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn rejects_empty_store_dir() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.store_dir = "".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn loads_from_file_and_roundtrips() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), SAMPLE).unwrap();
        let cfg = Config::from_path(tmp.path()).unwrap();
        assert_eq!(cfg.from_block, 12345);

        // Round-trip back through serde without data loss.
        let reserialised = serde_json::to_string(&cfg).unwrap();
        let back: Config = serde_json::from_str(&reserialised).unwrap();
        back.validate().unwrap();
    }

    #[test]
    fn missing_file_is_io_error() {
        assert!(matches!(
            Config::from_path(Path::new("/not/here.json")),
            Err(ConfigError::Io { .. })
        ));
    }
}
