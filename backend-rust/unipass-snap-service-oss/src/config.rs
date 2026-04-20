//! Configuration — JSON file (or env override) mirroring the
//! closed-source `snap_config` crate.

use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_bind")]
    pub bind: String,
    #[serde(default = "default_port")]
    pub port: u16,

    /// Comma-separated allow-list of origins for CORS. Empty (the
    /// default) means same-origin only. Wildcard `"*"` is NOT
    /// honoured on purpose — this is a JWT-issuing service and an
    /// any-origin posture would let any webpage craft login
    /// requests against it. See round-8 docs / M-1.
    #[serde(default)]
    pub cors_allowed_origins: String,

    pub mysql: MysqlConfig,
    pub redis: RedisConfig,

    pub jwt: JwtConfig,
    pub relayer: RelayerConfig,
    pub free_quota_signer: FreeQuotaSignerConfig,

    #[serde(default)]
    pub log_json: bool,
}

fn default_bind() -> String { "0.0.0.0".into() }
fn default_port() -> u16 { 8080 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MysqlConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    #[serde(default = "default_mysql_max_conns")]
    pub max_connections: u32,
}
fn default_mysql_max_conns() -> u32 { 20 }

impl MysqlConfig {
    pub fn url(&self) -> String {
        format!(
            "mysql://{}:{}@{}:{}/{}",
            url_enc(&self.user),
            url_enc(&self.password),
            self.host,
            self.port,
            self.database,
        )
    }
}

fn url_enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'@' | b':' | b'/' | b'%' | b'?' | b'#' | b' ' => out.push_str(&format!("%{b:02X}")),
            _ => out.push(b as char),
        }
    }
    out
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub db: u32,
    #[serde(default = "default_redis_pool")]
    pub pool_max_size: usize,
}
fn default_redis_pool() -> usize { 16 }

impl RedisConfig {
    pub fn url(&self) -> String {
        format!("redis://{}:{}/{}", self.host, self.port, self.db)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtConfig {
    /// HS256 secret used to sign session JWTs. Base64- or hex-encoded
    /// string, minimum 32 bytes after decoding.
    pub hs256_secret: String,
    #[serde(default = "default_jwt_ttl")]
    pub token_ttl_secs: u64,
    #[serde(default = "default_jwt_issuer")]
    pub issuer: String,
}
fn default_jwt_ttl() -> u64 { 3600 * 24 * 7 }
fn default_jwt_issuer() -> String { "unipass-snap-service".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayerConfig {
    /// HTTP endpoint that accepts signed tx bundles and pushes them on chain.
    pub base_url: String,
    #[serde(default = "default_relay_timeout")]
    pub timeout_secs: u64,
    #[serde(default = "default_relay_retries")]
    pub max_retries: u32,
}
fn default_relay_timeout() -> u64 { 30 }
fn default_relay_retries() -> u32 { 3 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreeQuotaSignerConfig {
    /// Hex-encoded ECDSA private key signing the `free_sig` blob.
    /// Loaded once at startup; never logged.
    pub signer_private_key: String,
    /// Per-chain free-quota contract addresses.
    pub contract_addresses: std::collections::HashMap<u64, String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("missing env var: {0}")]
    MissingVar(&'static str),
    #[error("read {path}: {source}")]
    Io { path: std::path::PathBuf, source: std::io::Error },
    #[error("parse: {0}")]
    Parse(String),
    #[error("invalid jwt secret: {0}")]
    InvalidJwtSecret(String),
    #[error("invalid signer key: {0}")]
    InvalidSignerKey(String),
}

impl Config {
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
        // JWT secret must decode to at least 32 bytes.
        let raw = self.jwt.hs256_secret.as_bytes();
        let decoded_len = if raw.iter().all(|b| b.is_ascii_hexdigit()) && raw.len() % 2 == 0 {
            raw.len() / 2
        } else {
            raw.len()
        };
        if decoded_len < 32 {
            return Err(ConfigError::InvalidJwtSecret(format!(
                "expected ≥32 bytes, got {decoded_len}"
            )));
        }

        // Signer private key must be exactly 32 bytes hex.
        let s = self
            .free_quota_signer
            .signer_private_key
            .strip_prefix("0x")
            .unwrap_or(&self.free_quota_signer.signer_private_key);
        let bytes = hex::decode(s).map_err(|e| ConfigError::InvalidSignerKey(e.to_string()))?;
        if bytes.len() != 32 {
            return Err(ConfigError::InvalidSignerKey(format!(
                "expected 32 bytes, got {}",
                bytes.len()
            )));
        }

        if self.free_quota_signer.contract_addresses.is_empty() {
            return Err(ConfigError::Parse("contract_addresses must not be empty".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
        "bind": "127.0.0.1",
        "port": 8090,
        "mysql": {"host":"db","port":3306,"user":"u","password":"p@/w","database":"snap","max_connections":10},
        "redis": {"host":"r","port":6379,"db":0,"pool_max_size":8},
        "jwt": {"hs256_secret":"0000000000000000000000000000000000000000000000000000000000000000","token_ttl_secs":86400},
        "relayer": {"base_url":"http://relayer","timeout_secs":5,"max_retries":2},
        "free_quota_signer": {
            "signer_private_key": "0x1111111111111111111111111111111111111111111111111111111111111111",
            "contract_addresses": {"1": "0x00000000000000000000000000000000deadBEEF"}
        }
    }"#;

    #[test]
    fn parses_sample() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(cfg.port, 8090);
        assert_eq!(cfg.mysql.database, "snap");
        assert_eq!(cfg.jwt.token_ttl_secs, 86400);
        cfg.validate().unwrap();
    }

    #[test]
    fn applies_defaults() {
        let mut v: serde_json::Value = serde_json::from_str(SAMPLE).unwrap();
        v.as_object_mut().unwrap().remove("bind");
        v.as_object_mut().unwrap().remove("port");
        let src = serde_json::to_string(&v).unwrap();
        let cfg: Config = serde_json::from_str(&src).unwrap();
        assert_eq!(cfg.bind, "0.0.0.0");
        assert_eq!(cfg.port, 8080);
        assert_eq!(cfg.jwt.issuer, "unipass-snap-service");
    }

    #[test]
    fn mysql_url_encodes_password() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        let url = cfg.mysql.url();
        assert!(url.contains("p%40%2Fw"));
    }

    #[test]
    fn validates_jwt_too_short() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.jwt.hs256_secret = "short".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::InvalidJwtSecret(_))));
    }

    #[test]
    fn validates_signer_key_length() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.free_quota_signer.signer_private_key = "0xdeadbeef".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::InvalidSignerKey(_))));
    }

    #[test]
    fn rejects_empty_contracts_map() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.free_quota_signer.contract_addresses.clear();
        assert!(matches!(cfg.validate(), Err(ConfigError::Parse(_))));
    }

    #[test]
    fn loads_from_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), SAMPLE).unwrap();
        let cfg = Config::from_path(tmp.path()).unwrap();
        assert_eq!(cfg.port, 8090);
    }

    #[test]
    fn load_missing_file_returns_io_error() {
        assert!(matches!(
            Config::from_path(Path::new("/nope/whoa.json")),
            Err(ConfigError::Io { .. })
        ));
    }
}
