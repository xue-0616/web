//! Configuration types.
//!
//! Reconstructed from the closed-source ELF by decoding the struct-with-N-elements
//! serde errors in its `.rodata`:
//!
//! ```text
//! struct AssetMigratorConfigs with 17 elements
//! struct PublicConfig with 13 elements
//! struct MySqlInfo with 6 elements
//! struct RedisInfo with 9 elements
//! struct ClientConfig with 5 elements
//! struct SubmitterInfo with 3 elements
//! struct InboundCoinInfo with 7 elements
//! struct InboundChainInfo with 3 elements
//! struct OutboundCoinInfo with 6 elements
//! struct OutboundChainInfo with 6 elements
//! struct DepositAddresses with 2 elements
//! ```
//!
//! Field names were recovered from adjacent serde error strings (e.g.
//! `"host port coin database bind code max_connections"` for `MySqlInfo`,
//! with `coin` likely being a typo in the symbol dump for `user`).

use std::{fs, path::Path, time::Duration};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetMigratorConfigs {
    pub sql_db: MySqlInfo,
    pub redis: RedisInfo,
    #[serde(default)]
    pub log_output_to_cli: bool,
    #[serde(default)]
    pub log_json_format: bool,

    pub inbound_coin_infos: Vec<InboundCoinInfo>,
    pub inbound_chain_infos: Vec<InboundChainInfo>,
    pub outbound_chain_infos: Vec<OutboundChainInfo>,
    pub outbound_coin_infos: Vec<OutboundCoinInfo>,

    pub custody_wallet_client: ClientConfig,
    pub custody_wallet_api_priv_key: String,

    pub submitter_infos: Vec<SubmitterInfo>,

    pub address_batch_threshold: u32,
    pub unbind_addresses_threshold: u32,
    #[serde(with = "secs_duration")]
    pub deposit_address_worker_interval: Duration,

    #[serde(default)]
    pub slack_webhook: Option<String>,

    #[serde(default = "default_bind")]
    pub bind: String,

    /// HTTP port; actix-web listens here.
    #[serde(default = "default_port")]
    pub port: u16,
}

fn default_bind() -> String {
    "0.0.0.0".into()
}
fn default_port() -> u16 {
    8080
}

mod secs_duration {
    //! Serde helper: serialise [`Duration`] as whole seconds.
    use serde::{Deserialize, Deserializer, Serializer};
    use std::time::Duration;

    pub fn serialize<S: Serializer>(d: &Duration, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_u64(d.as_secs())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Duration, D::Error> {
        let secs = u64::deserialize(d)?;
        Ok(Duration::from_secs(secs))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MySqlInfo {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    pub max_connections: u32,
}

impl MySqlInfo {
    /// Compose a sqlx-compatible connection URL. We do NOT include the
    /// password in any log output — do not change this to `Display`.
    pub fn url(&self) -> String {
        use std::fmt::Write as _;
        let mut u = String::with_capacity(128);
        write!(
            &mut u,
            "mysql://{user}:{pass}@{host}:{port}/{db}",
            user = urlencoding_minimal(&self.user),
            pass = urlencoding_minimal(&self.password),
            host = self.host,
            port = self.port,
            db = self.database,
        )
        .expect("write! to String cannot fail");
        u
    }
}

/// Minimal percent-encoding for a handful of characters the MySQL connection
/// string parser chokes on. We don't pull in a full encoder because this
/// is only used for three fields (user / password / database) that are
/// unlikely to contain anything exotic — but we do escape the common
/// accidents (`@`, `:`, `/`, ` `, `%`).
fn urlencoding_minimal(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'@' | b':' | b'/' | b' ' | b'%' | b'?' | b'#' => {
                out.push_str(&format!("%{:02X}", b));
            }
            _ => out.push(b as char),
        }
    }
    out
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisInfo {
    pub host: String,
    pub port: u16,
    pub db: u32,
    pub pool_max_size: usize,
    pub pool_wait_time_secs: u64,
    pub pool_create_time_secs: u64,
    pub stream_max_len: usize,
    pub min_retry_interval_millis: u64,
    pub max_retry_interval_millis: u64,
    #[serde(default = "default_max_retries")]
    pub max_n_retries: u32,
}

fn default_max_retries() -> u32 {
    5
}

impl RedisInfo {
    pub fn url(&self) -> String {
        format!("redis://{}:{}/{}", self.host, self.port, self.db)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    /// Base URL of the custody wallet API (e.g. BitGo / Fireblocks / in-house).
    pub base_url: String,
    /// HTTP connect timeout, seconds.
    pub connect_timeout_secs: u64,
    /// Per-request timeout, seconds.
    pub request_timeout_secs: u64,
    /// Max retry attempts for 5xx / network errors.
    pub max_retries: u32,
    /// User-agent header to send.
    #[serde(default = "default_user_agent")]
    pub user_agent: String,
}

fn default_user_agent() -> String {
    concat!("asset-migrator-oss/", env!("CARGO_PKG_VERSION")).into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitterInfo {
    pub chain_name: String,
    /// Hex-encoded ECDSA private keys (one per concurrent submitter). Each
    /// funds its own outbound txs from its own nonce pool.
    pub signers: Vec<String>,
    /// Slot in the HD-wallet derivation path, if using a shared mnemonic.
    /// Zero means "use `signers[0]` directly as a raw key".
    #[serde(default)]
    pub slot: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboundCoinInfo {
    pub chain_name: String,
    pub coin_name: String,
    pub token_address: String,
    pub outbound_chain_id: u64,
    pub outbound_coin: String,
    pub token_decimal: u8,
    pub confirm_block_threshold: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboundChainInfo {
    pub chain_name: String,
    pub rpc_url: String,
    pub offline_check_threshold: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboundCoinInfo {
    pub chain_name: String,
    pub coin_name: String,
    pub token_address: String,
    pub token_decimal: u8,
    pub min_transfer_amount: String,
    pub max_transfer_amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboundChainInfo {
    pub chain_name: String,
    pub chain_id: u64,
    pub rpc_url: String,
    pub submitter_balance_threshold: String,
    pub max_gas_price: String,
    pub offline_check_threshold: u64,
}

/// Subset of [`AssetMigratorConfigs`] safe to expose via the `/config` HTTP
/// endpoint. Matches `struct PublicConfig with 13 elements` from the ELF.
#[derive(Debug, Clone, Serialize)]
pub struct PublicConfig<'a> {
    pub inbound_coin_infos: &'a [InboundCoinInfo],
    pub inbound_chain_infos: &'a [InboundChainInfo],
    pub outbound_coin_infos: &'a [OutboundCoinInfo],
    pub outbound_chain_infos: &'a [OutboundChainInfo],
    pub address_batch_threshold: u32,
    pub unbind_addresses_threshold: u32,
    pub deposit_address_worker_interval_secs: u64,
    pub bind: &'a str,
    pub port: u16,
}

impl AssetMigratorConfigs {
    pub fn public(&self) -> PublicConfig<'_> {
        PublicConfig {
            inbound_coin_infos: &self.inbound_coin_infos,
            inbound_chain_infos: &self.inbound_chain_infos,
            outbound_coin_infos: &self.outbound_coin_infos,
            outbound_chain_infos: &self.outbound_chain_infos,
            address_batch_threshold: self.address_batch_threshold,
            unbind_addresses_threshold: self.unbind_addresses_threshold,
            deposit_address_worker_interval_secs: self
                .deposit_address_worker_interval
                .as_secs(),
            bind: &self.bind,
            port: self.port,
        }
    }

    /// Load config from a JSON file. Path resolved from `CONFIG_PATH` env
    /// if `path` is `None`.
    pub fn load(path: Option<&Path>) -> Result<Self, ConfigError> {
        let path_buf;
        let path = match path {
            Some(p) => p,
            None => {
                let s = std::env::var("CONFIG_PATH")
                    .map_err(|_| ConfigError::MissingVar("CONFIG_PATH"))?;
                path_buf = std::path::PathBuf::from(s);
                &path_buf
            }
        };
        let body = fs::read(path).map_err(|e| ConfigError::Io {
            path: path.to_path_buf(),
            source: e,
        })?;
        let cfg: Self = serde_json::from_slice(&body)
            .map_err(|e| ConfigError::Parse(e.to_string()))?;
        Ok(cfg)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("missing required env var: {0}")]
    MissingVar(&'static str),
    #[error("reading config file {path}: {source}")]
    Io {
        path: std::path::PathBuf,
        source: std::io::Error,
    },
    #[error("parse error: {0}")]
    Parse(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_CONFIG: &str = r#"{
        "sql_db": {
            "host": "localhost", "port": 3306, "user": "am", "password": "p@ss/w",
            "database": "asset_migrator", "max_connections": 20
        },
        "redis": {
            "host": "127.0.0.1", "port": 6379, "db": 0, "pool_max_size": 16,
            "pool_wait_time_secs": 5, "pool_create_time_secs": 5,
            "stream_max_len": 10000, "min_retry_interval_millis": 100,
            "max_retry_interval_millis": 5000, "max_n_retries": 5
        },
        "log_output_to_cli": true,
        "log_json_format": false,
        "inbound_coin_infos": [
            {"chain_name":"ethereum","coin_name":"USDC","token_address":"0xA0b...","outbound_chain_id":137,"outbound_coin":"USDC","token_decimal":6,"confirm_block_threshold":12}
        ],
        "inbound_chain_infos": [
            {"chain_name":"ethereum","rpc_url":"https://mainnet.infura.io/v3/x","offline_check_threshold":30}
        ],
        "outbound_chain_infos": [
            {"chain_name":"polygon","chain_id":137,"rpc_url":"https://polygon-rpc.com","submitter_balance_threshold":"1000000000000000000","max_gas_price":"500000000000","offline_check_threshold":30}
        ],
        "outbound_coin_infos": [
            {"chain_name":"polygon","coin_name":"USDC","token_address":"0x2791...","token_decimal":6,"min_transfer_amount":"1000000","max_transfer_amount":"100000000000"}
        ],
        "custody_wallet_client": {
            "base_url":"https://custody.internal/api","connect_timeout_secs":5,
            "request_timeout_secs":30,"max_retries":3
        },
        "custody_wallet_api_priv_key": "0xdeadbeef",
        "submitter_infos": [
            {"chain_name":"polygon","signers":["0xaaa","0xbbb"],"slot":0}
        ],
        "address_batch_threshold": 50,
        "unbind_addresses_threshold": 100,
        "deposit_address_worker_interval": 30,
        "slack_webhook": "https://hooks.slack.com/x"
    }"#;

    #[test]
    fn parses_full_config() {
        let cfg: AssetMigratorConfigs = serde_json::from_str(SAMPLE_CONFIG).unwrap();
        assert_eq!(cfg.sql_db.port, 3306);
        assert_eq!(cfg.redis.pool_max_size, 16);
        assert_eq!(cfg.inbound_coin_infos.len(), 1);
        assert_eq!(cfg.submitter_infos[0].signers.len(), 2);
        assert_eq!(cfg.deposit_address_worker_interval.as_secs(), 30);
        assert_eq!(cfg.slack_webhook.as_deref(), Some("https://hooks.slack.com/x"));
        assert_eq!(cfg.bind, "0.0.0.0"); // default applied
        assert_eq!(cfg.port, 8080);       // default applied
    }

    #[test]
    fn public_config_excludes_secrets() {
        let cfg: AssetMigratorConfigs = serde_json::from_str(SAMPLE_CONFIG).unwrap();
        let pubcfg = cfg.public();
        let json = serde_json::to_string(&pubcfg).unwrap();
        // Hard invariant: secrets must never leak via /config.
        assert!(!json.contains("p@ss"), "password leaked via public config");
        assert!(!json.contains("deadbeef"), "priv key leaked");
        assert!(!json.contains("0xaaa"), "submitter signers leaked");
        assert!(!json.contains("slack.com"), "slack webhook leaked");
    }

    #[test]
    fn mysql_url_composes_correctly() {
        let cfg: AssetMigratorConfigs = serde_json::from_str(SAMPLE_CONFIG).unwrap();
        let url = cfg.sql_db.url();
        // `p@ss/w` must be percent-encoded to `p%40ss%2Fw` or the URL parser
        // will interpret the `@` as the separator between user and host.
        assert!(url.contains("p%40ss%2Fw"), "password not encoded: {url}");
        assert!(url.starts_with("mysql://"));
        assert!(url.ends_with("/asset_migrator"));
    }

    #[test]
    fn redis_url_composes_correctly() {
        let cfg: AssetMigratorConfigs = serde_json::from_str(SAMPLE_CONFIG).unwrap();
        assert_eq!(cfg.redis.url(), "redis://127.0.0.1:6379/0");
    }

    #[test]
    fn loads_from_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), SAMPLE_CONFIG).unwrap();
        let cfg = AssetMigratorConfigs::load(Some(tmp.path())).unwrap();
        assert_eq!(cfg.sql_db.database, "asset_migrator");
    }

    #[test]
    fn load_missing_config_path_env() {
        // SAFETY: env mutation in tests — this one variable is only
        // touched here, so no other parallel test reads it.
        unsafe { std::env::remove_var("CONFIG_PATH") };
        assert!(matches!(
            AssetMigratorConfigs::load(None),
            Err(ConfigError::MissingVar("CONFIG_PATH"))
        ));
    }

    #[test]
    fn load_missing_file_returns_io_error() {
        let path = std::path::Path::new("/definitely/does/not/exist.json");
        match AssetMigratorConfigs::load(Some(path)) {
            Err(ConfigError::Io { .. }) => {}
            other => panic!("expected Io error, got {other:?}"),
        }
    }

    #[test]
    fn load_malformed_json_returns_parse_error() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), "{ not json").unwrap();
        match AssetMigratorConfigs::load(Some(tmp.path())) {
            Err(ConfigError::Parse(_)) => {}
            other => panic!("expected Parse error, got {other:?}"),
        }
    }
}
