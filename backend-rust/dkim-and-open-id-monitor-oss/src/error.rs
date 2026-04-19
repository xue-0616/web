#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("config: {0}")]
    Config(#[from] crate::config::ConfigError),
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("dns: {0}")]
    Dns(String),
    #[error("chain: {0}")]
    Chain(String),
    #[error("jwks: {0}")]
    Jwks(String),
    #[error("slack: {0}")]
    Slack(String),
    #[error("internal: {0}")]
    Internal(String),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
