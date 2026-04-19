//! Configuration.
//!
//! JSON file or env-var driven. Maps one config → multiple chains: the
//! closed-source ELF supported multi-chain sponsorship in a single
//! process by keying everything on `chain_id`.

use std::{collections::HashMap, fs, path::Path};

use ethers_core::types::Address;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// JSON-RPC server bind address (e.g. `0.0.0.0:8080`).
    #[serde(default = "default_bind")]
    pub bind: String,

    /// Hex-encoded ECDSA private key (32 bytes, 0x-prefixed) used to sign
    /// paymasterAndData. This MUST match the `verifyingSigner` configured
    /// in the on-chain VerifyingPaymaster contract.
    pub signer_private_key: String,

    /// Per-chain config keyed by `chain_id`.
    pub chains: HashMap<u64, ChainConfig>,

    /// Optional sender whitelist (addresses permitted to request
    /// sponsorship). Empty → open-to-all (not recommended in prod).
    #[serde(default)]
    pub whitelist: Vec<Address>,

    /// Default validity window in seconds: the signed `paymasterAndData`
    /// will carry `validUntil = now + validity_window_secs`.
    #[serde(default = "default_validity_window")]
    pub validity_window_secs: u64,
}

fn default_bind() -> String { "0.0.0.0:8080".into() }
fn default_validity_window() -> u64 { 600 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    /// VerifyingPaymaster contract address on this chain.
    pub paymaster_address: Address,
    /// EntryPoint address (typically 0x5FF1...0789 for ERC-4337 v0.6).
    pub entry_point: Address,
    /// Optional RPC endpoint for pre-validation (nonce/balance checks).
    #[serde(default)]
    pub rpc_url: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("missing env var: {0}")]
    MissingVar(&'static str),
    #[error("read {path}: {source}")]
    Io { path: std::path::PathBuf, source: std::io::Error },
    #[error("parse: {0}")]
    Parse(String),
    #[error("invalid signer key: {0}")]
    InvalidSignerKey(String),
}

impl Config {
    /// Load from JSON file at `CONFIG_PATH`.
    pub fn from_env() -> Result<Self, ConfigError> {
        let path = std::env::var("CONFIG_PATH")
            .map_err(|_| ConfigError::MissingVar("CONFIG_PATH"))?;
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
        // Signer key sanity check — should decode to exactly 32 bytes.
        let s = self.signer_private_key
            .strip_prefix("0x").unwrap_or(&self.signer_private_key);
        let bytes = hex::decode(s)
            .map_err(|e| ConfigError::InvalidSignerKey(e.to_string()))?;
        if bytes.len() != 32 {
            return Err(ConfigError::InvalidSignerKey(format!(
                "expected 32 bytes, got {}",
                bytes.len()
            )));
        }
        if self.chains.is_empty() {
            return Err(ConfigError::Parse("chains map is empty".into()));
        }
        Ok(())
    }

    /// Is `sender` allowed to request sponsorship?
    ///
    /// Policy: empty whitelist → allow everyone (dev / open-sponsor mode).
    /// Non-empty whitelist → membership required.
    pub fn is_allowed(&self, sender: &Address) -> bool {
        self.whitelist.is_empty() || self.whitelist.iter().any(|a| a == sender)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    const SAMPLE: &str = r#"{
        "bind": "0.0.0.0:9000",
        "signer_private_key": "0x1111111111111111111111111111111111111111111111111111111111111111",
        "chains": {
            "1": {
                "paymaster_address": "0x0000000000000000000000000000000000001234",
                "entry_point": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
            }
        },
        "whitelist": ["0x00000000000000000000000000000000deadBEEF"],
        "validity_window_secs": 300
    }"#;

    #[test]
    fn parses_sample() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(cfg.bind, "0.0.0.0:9000");
        assert_eq!(cfg.validity_window_secs, 300);
        assert_eq!(cfg.chains.len(), 1);
        assert_eq!(cfg.whitelist.len(), 1);
    }

    #[test]
    fn applies_defaults() {
        let src = r#"{
            "signer_private_key": "0x1111111111111111111111111111111111111111111111111111111111111111",
            "chains": {
                "1": {
                    "paymaster_address": "0x0000000000000000000000000000000000001234",
                    "entry_point": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
                }
            }
        }"#;
        let cfg: Config = serde_json::from_str(src).unwrap();
        assert_eq!(cfg.bind, "0.0.0.0:8080");
        assert_eq!(cfg.validity_window_secs, 600);
        assert!(cfg.whitelist.is_empty());
    }

    #[test]
    fn validates_signer_key_length() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.signer_private_key = "0xdeadbeef".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::InvalidSignerKey(_))));
    }

    #[test]
    fn validates_signer_key_hex() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.signer_private_key = "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::InvalidSignerKey(_))));
    }

    #[test]
    fn rejects_empty_chains_map() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.chains.clear();
        assert!(matches!(cfg.validate(), Err(ConfigError::Parse(_))));
    }

    #[test]
    fn is_allowed_open_when_whitelist_empty() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.whitelist.clear();
        let random = Address::from_str("0x1111111111111111111111111111111111111111").unwrap();
        assert!(cfg.is_allowed(&random));
    }

    #[test]
    fn is_allowed_enforces_whitelist_when_set() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        let permitted = Address::from_str("0x00000000000000000000000000000000deadBEEF").unwrap();
        let not_permitted = Address::from_str("0x1111111111111111111111111111111111111111").unwrap();
        assert!(cfg.is_allowed(&permitted));
        assert!(!cfg.is_allowed(&not_permitted));
    }

    #[test]
    fn loads_from_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), SAMPLE).unwrap();
        let cfg = Config::from_path(tmp.path()).unwrap();
        assert_eq!(cfg.chains.len(), 1);
    }

    #[test]
    fn load_missing_file_returns_io_error() {
        let p = std::path::Path::new("/definitely/not/here.json");
        assert!(matches!(Config::from_path(p), Err(ConfigError::Io { .. })));
    }

    #[test]
    fn load_malformed_json_returns_parse_error() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), "{ not json").unwrap();
        assert!(matches!(Config::from_path(tmp.path()), Err(ConfigError::Parse(_))));
    }
}
