//! Configuration types.
//!
//! The original closed-source binary had:
//!
//!   * `config::TradingTrackerConfig` with `serde::Deserialize` + a `new()`
//!     constructor that takes a path.
//!   * `config::TradingTrackerNode` with a `FromStr` impl (compact
//!     representation of endpoint+auth+package+module on a single string).
//!
//! Environment variables observed in `backend-bin/trading-tracker/dev.env`:
//!
//! ```text
//! TRADING_TRACKER_SUBSTREAMS_ENDPOINT=http://host:port/
//! TRADING_TRACKER_SOLANA_RPC=http://host:port
//! TRADING_TRACKER_START_BLOCK=307192322
//! TRADING_TRACKER_DB_PATH=./data/db
//! TRADING_TRACKER_LOG_OUTPUT_FORMAT=json
//! ```

use std::{net::SocketAddr, path::PathBuf, str::FromStr};

use serde::{Deserialize, Serialize};
use solana_pubkey::Pubkey;

use crate::dex_pool::DexKind;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TradingTrackerConfig {
    pub node: TradingTrackerNode,
    pub solana_rpc: String,
    pub start_block: u64,
    pub db_path: PathBuf,
    #[serde(default)]
    pub log_format: LogFormat,
    pub rpc: RpcBindCfg,
    #[serde(default)]
    pub pools: Vec<PoolConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TradingTrackerNode {
    /// StreamingFast substreams endpoint (https://mainnet.sol.streamingfast.io:443).
    pub endpoint: String,
    /// Optional API key (sent via the `x-api-key` gRPC metadata header).
    #[serde(default)]
    pub api_key: Option<String>,
    /// Substreams `.spkg` location (URL or local path). The deployed binary
    /// appears to ship with this bundled alongside the ELF.
    pub package: String,
    /// Module name inside the .spkg to subscribe to (e.g. `map_dex_trades`).
    pub module: String,
}

/// `TradingTrackerNode` also implements FromStr for "endpoint#package@module"
/// shorthand — matches the FromStr impl observed in the closed-source binary.
impl FromStr for TradingTrackerNode {
    type Err = ConfigError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (endpoint_part, rest) = s.split_once('#').ok_or(ConfigError::InvalidNodeShorthand)?;
        let (package, module) = rest.split_once('@').ok_or(ConfigError::InvalidNodeShorthand)?;
        Ok(TradingTrackerNode {
            endpoint: endpoint_part.to_string(),
            api_key: None,
            package: package.to_string(),
            module: module.to_string(),
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RpcBindCfg {
    pub listen_addr: SocketAddr,
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,
}

fn default_max_connections() -> u32 {
    1_024
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    #[default]
    Pretty,
    Json,
}

/// A single pool to track. `kind` selects which DEX parser will be invoked
/// against the instructions touching this pool.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PoolConfig {
    pub kind: DexKind,
    pub address: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    /// For Pump.fun bonding curves: the bonding-curve account address.
    #[serde(default)]
    pub bonding_curve: Option<Pubkey>,
}

impl TradingTrackerConfig {
    /// Load the config. Prefer a TOML file at `$TRADING_TRACKER_CONFIG` or
    /// `./config.toml`, otherwise build one from `TRADING_TRACKER_*`
    /// environment variables (matching the observed `dev.env`).
    pub fn new(path: impl AsRef<std::path::Path>) -> Result<Self, ConfigError> {
        let text = std::fs::read_to_string(path.as_ref())
            .map_err(|e| ConfigError::Io(path.as_ref().display().to_string(), e))?;
        toml::from_str(&text).map_err(ConfigError::Toml)
    }

    pub fn load() -> Result<Self, ConfigError> {
        if let Ok(p) = std::env::var("TRADING_TRACKER_CONFIG") {
            return Self::new(p);
        }
        let default_path = std::path::Path::new("./config.toml");
        if default_path.exists() {
            return Self::new(default_path);
        }
        Self::from_env()
    }

    /// Build from TRADING_TRACKER_* env vars alone (no config file).
    pub fn from_env() -> Result<Self, ConfigError> {
        #[derive(Deserialize)]
        struct Raw {
            substreams_endpoint: String,
            #[serde(default)]
            substreams_api_key: Option<String>,
            #[serde(default = "default_package")]
            substreams_package: String,
            #[serde(default = "default_module")]
            substreams_module: String,
            solana_rpc: String,
            start_block: u64,
            db_path: PathBuf,
            #[serde(default = "default_log_format")]
            log_output_format: String,
            #[serde(default = "default_rpc_listen")]
            rpc_listen_addr: String,
        }
        fn default_package() -> String {
            "./substreams.spkg".to_string()
        }
        fn default_module() -> String {
            "map_dex_trades".to_string()
        }
        fn default_log_format() -> String {
            "json".to_string()
        }
        fn default_rpc_listen() -> String {
            "0.0.0.0:8080".to_string()
        }
        let raw: Raw = envy::prefixed("TRADING_TRACKER_")
            .from_env()
            .map_err(ConfigError::Envy)?;
        let log_format = match raw.log_output_format.as_str() {
            "pretty" | "human" => LogFormat::Pretty,
            _ => LogFormat::Json,
        };
        let listen_addr: SocketAddr = raw
            .rpc_listen_addr
            .parse()
            .map_err(|_| ConfigError::InvalidListenAddr(raw.rpc_listen_addr.clone()))?;
        Ok(Self {
            node: TradingTrackerNode {
                endpoint: raw.substreams_endpoint,
                api_key: raw.substreams_api_key,
                package: raw.substreams_package,
                module: raw.substreams_module,
            },
            solana_rpc: raw.solana_rpc,
            start_block: raw.start_block,
            db_path: raw.db_path,
            log_format,
            rpc: RpcBindCfg {
                listen_addr,
                max_connections: default_max_connections(),
            },
            pools: Vec::new(),
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("failed to read config file {0}: {1}")]
    Io(String, #[source] std::io::Error),
    #[error("invalid TOML in config file: {0}")]
    Toml(#[source] toml::de::Error),
    #[error("missing TRADING_TRACKER_* env vars: {0}")]
    Envy(#[source] envy::Error),
    #[error("invalid listen address: {0}")]
    InvalidListenAddr(String),
    #[error("invalid node shorthand; expected 'endpoint#package@module'")]
    InvalidNodeShorthand,
}
