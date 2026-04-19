//! `ZkServerConfigs` — 11 fields, recovered from rodata.
//!
//! Also bundles `MySqlInfo` (6 fields) and `RedisInfo` (6 fields).

use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_bind")]
    pub bind: String,
    #[serde(default = "default_port")]
    pub port: u16,

    pub mysql: MySqlInfo,
    pub redis: RedisInfo,

    pub zk: ZkParamsConfig,

    /// Redis stream name that the scheduler consumes.
    #[serde(default = "default_stream_name")]
    pub task_stream: String,
    #[serde(default = "default_consumer_group")]
    pub consumer_group: String,
    #[serde(default = "default_consumer_name")]
    pub consumer_name: String,

    #[serde(default = "default_worker_concurrency")]
    pub worker_concurrency: usize,

    #[serde(default)]
    pub log_json: bool,

    /// Optional path prefix for saving generated proofs (debug only).
    #[serde(default)]
    pub proof_dump_dir: Option<String>,
}

fn default_bind() -> String { "0.0.0.0".into() }
fn default_port() -> u16 { 8080 }
fn default_stream_name() -> String { "zk_server_tasks".into() }
fn default_consumer_group() -> String { "zk_workers".into() }
fn default_consumer_name() -> String { "zk_worker_1".into() }
fn default_worker_concurrency() -> usize { 2 }

/// `struct MySqlInfo with 6 elements` — host/port/user/password/database + max_conns.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MySqlInfo {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    #[serde(default = "default_max_conns")]
    pub max_connections: u32,
}
fn default_max_conns() -> u32 { 20 }

impl MySqlInfo {
    pub fn url(&self) -> String {
        let enc = |s: &str| {
            s.bytes().fold(String::new(), |mut acc, b| {
                match b {
                    b'@' | b':' | b'/' | b'%' | b'?' | b'#' | b' ' => {
                        acc.push_str(&format!("%{b:02X}"));
                    }
                    _ => acc.push(b as char),
                }
                acc
            })
        };
        format!(
            "mysql://{}:{}@{}:{}/{}",
            enc(&self.user),
            enc(&self.password),
            self.host,
            self.port,
            self.database
        )
    }
}

/// `struct RedisInfo with 6 elements`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisInfo {
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub db: u32,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default = "default_redis_pool")]
    pub pool_max_size: usize,
}
fn default_redis_pool() -> usize { 16 }

impl RedisInfo {
    pub fn url(&self) -> String {
        match (&self.username, &self.password) {
            (Some(u), Some(p)) => format!("redis://{}:{}@{}:{}/{}", u, p, self.host, self.port, self.db),
            (None, Some(p)) => format!("redis://:{}@{}:{}/{}", p, self.host, self.port, self.db),
            _ => format!("redis://{}:{}/{}", self.host, self.port, self.db),
        }
    }
}

/// `struct ZkParams with 2 elements` — two SRS sizes loaded at startup.
/// The closed-source ELF logs "Params 1024 Load finished" and
/// "Params 2048 Load finished" (see rodata).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZkParamsConfig {
    /// Path to the 1024-sized PLONK SRS (OpenID flow).
    pub srs_1024_path: String,
    /// Path to the 2048-sized PLONK SRS (SMTP flow).
    pub srs_2048_path: String,
    /// Optional proving key (PCKey) binary; when present, the prover
    /// skips `Setup` and loads directly. Matches the ELF's
    /// "PCKey Load finished" log line.
    #[serde(default)]
    pub pc_key_path: Option<String>,
}

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
        if self.worker_concurrency == 0 {
            return Err(ConfigError::Validation("worker_concurrency must be >= 1".into()));
        }
        if self.task_stream.is_empty() {
            return Err(ConfigError::Validation("task_stream must be non-empty".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
        "bind": "127.0.0.1",
        "port": 9090,
        "mysql": {"host":"db","port":3306,"user":"u","password":"p@s","database":"zk","max_connections":10},
        "redis": {"host":"r","port":6379,"db":1,"password":"secret","pool_max_size":8},
        "zk": {"srs_1024_path": "/srs/1k.bin", "srs_2048_path": "/srs/2k.bin"},
        "task_stream": "zk_tasks",
        "consumer_group": "workers",
        "consumer_name": "w0",
        "worker_concurrency": 4
    }"#;

    #[test]
    fn parses_sample() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(cfg.port, 9090);
        assert_eq!(cfg.mysql.database, "zk");
        assert_eq!(cfg.redis.db, 1);
        assert_eq!(cfg.worker_concurrency, 4);
        cfg.validate().unwrap();
    }

    #[test]
    fn applies_defaults() {
        let src = r#"{
            "mysql": {"host":"db","port":3306,"user":"u","password":"p","database":"zk"},
            "redis": {"host":"r","port":6379},
            "zk": {"srs_1024_path": "/a", "srs_2048_path": "/b"}
        }"#;
        let cfg: Config = serde_json::from_str(src).unwrap();
        assert_eq!(cfg.bind, "0.0.0.0");
        assert_eq!(cfg.port, 8080);
        assert_eq!(cfg.task_stream, "zk_server_tasks");
        assert_eq!(cfg.consumer_group, "zk_workers");
        assert_eq!(cfg.worker_concurrency, 2);
        cfg.validate().unwrap();
    }

    #[test]
    fn mysql_url_encodes_password() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        let url = cfg.mysql.url();
        // '@' in 'p@s' must be percent-encoded
        assert!(url.contains("p%40s"));
    }

    #[test]
    fn redis_url_with_password_only() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(cfg.redis.url(), "redis://:secret@r:6379/1");
    }

    #[test]
    fn redis_url_no_auth_falls_back_to_plain() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.redis.password = None;
        assert_eq!(cfg.redis.url(), "redis://r:6379/1");
    }

    #[test]
    fn validates_worker_concurrency() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.worker_concurrency = 0;
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn validates_nonempty_stream() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.task_stream = "".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn loads_from_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), SAMPLE).unwrap();
        let cfg = Config::from_path(tmp.path()).unwrap();
        assert_eq!(cfg.port, 9090);
    }

    #[test]
    fn missing_file_maps_to_io() {
        assert!(matches!(
            Config::from_path(Path::new("/not/here.json")),
            Err(ConfigError::Io { .. })
        ));
    }

    #[test]
    fn malformed_json_maps_to_parse() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), "{ not json").unwrap();
        assert!(matches!(
            Config::from_path(tmp.path()),
            Err(ConfigError::Parse(_))
        ));
    }
}
