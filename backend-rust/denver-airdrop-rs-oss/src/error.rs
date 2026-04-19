#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("config: {0}")]
    Config(#[from] crate::config::ConfigError),
    #[error("io {path}: {source}")]
    Io { path: std::path::PathBuf, source: std::io::Error },
    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("chain: {0}")]
    Chain(String),
    #[error("internal: {0}")]
    Internal(String),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
