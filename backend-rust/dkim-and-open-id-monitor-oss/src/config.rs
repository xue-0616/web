//! Config — all fields recovered from ELF rodata.

use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    // ── Slack / alerting ────────────────────────────────────────────
    pub slack_webhook_url: String,

    // ── Polling cadences (recovered keys: certs_check_interval_secs,
    //    chain_check_interval_secs). The shorter `*_check_inte` dumps
    //    in rodata are just string truncation artefacts. ───────────
    #[serde(default = "default_certs_interval")]
    pub certs_check_interval_secs: u64,
    #[serde(default = "default_chain_interval")]
    pub chain_check_interval_secs: u64,

    /// Whether to refuse to act if the RPC node is visibly behind. The
    /// closed-source ELF gates every alert on this flag.
    #[serde(default = "default_true")]
    pub check_chain_sync: bool,

    // ── IMAP email account (used for DKIM self-test + diagnostics).
    //    Fields are recovered as a contiguous rodata block: imap_server_url,
    //    username, password, tls_type, smtp_server ─────────────────
    pub email: EmailAccount,

    // ── OpenID providers to monitor ───────────────────────────────
    pub open_id_providers: Vec<OpenIdProvider>,

    // ── DKIM domains/selectors to monitor ──────────────────────────
    pub dkim_targets: Vec<DkimTarget>,

    // ── Chain RPC + contract addresses for the on-chain log parser
    pub chain: ChainConfig,

    #[serde(default)]
    pub log_json: bool,
}

fn default_certs_interval() -> u64 { 3600 }
fn default_chain_interval() -> u64 { 300 }
fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailAccount {
    pub imap_server_url: String,
    pub username: String,
    pub password: String,
    #[serde(default = "default_tls")]
    pub tls_type: TlsType,
    pub smtp_server: String,
}

fn default_tls() -> TlsType { TlsType::StartTls }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TlsType {
    /// Classic IMAPS / SMTPS on dedicated TLS port.
    Tls,
    /// Plaintext then STARTTLS upgrade.
    StartTls,
    /// No TLS (DEBUG ONLY — never in production).
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenIdProvider {
    /// Canonical issuer URL, e.g. `https://accounts.google.com`.
    pub iss: String,
    /// JWKS URL (OIDC spec: `certs_url` in ELF rodata).
    pub certs_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DkimTarget {
    pub domain: String,
    pub selector: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub rpc_url: String,
    /// Contract that emits `DkimKeysLog` events.
    pub dkim_keys_contract: String,
    /// Contract that emits `OpenIdKeysLog` events.
    pub open_id_keys_contract: String,
    /// Max log-fetch block range per RPC call (eth_getLogs).
    #[serde(default = "default_max_block_range")]
    pub max_block_range: u64,
}

fn default_max_block_range() -> u64 { 10_000 }

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
        if !self.slack_webhook_url.starts_with("http") {
            return Err(ConfigError::Validation(
                "slack_webhook_url must be an http(s) URL".into(),
            ));
        }
        if self.certs_check_interval_secs == 0 {
            return Err(ConfigError::Validation(
                "certs_check_interval_secs must be >= 1".into(),
            ));
        }
        if self.chain_check_interval_secs == 0 {
            return Err(ConfigError::Validation(
                "chain_check_interval_secs must be >= 1".into(),
            ));
        }
        if self.open_id_providers.is_empty() && self.dkim_targets.is_empty() {
            return Err(ConfigError::Validation(
                "at least one of open_id_providers or dkim_targets must be non-empty".into(),
            ));
        }
        for p in &self.open_id_providers {
            if !p.iss.starts_with("https://") || !p.certs_url.starts_with("https://") {
                return Err(ConfigError::Validation(format!(
                    "open_id_provider must use https: {}",
                    p.iss
                )));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
        "slack_webhook_url": "https://hooks.slack.com/services/XXX",
        "certs_check_interval_secs": 600,
        "chain_check_interval_secs": 120,
        "check_chain_sync": true,
        "email": {
            "imap_server_url": "imap.example.com:993",
            "username": "bot@example.com",
            "password": "secret",
            "tls_type": "tls",
            "smtp_server": "smtp.example.com:465"
        },
        "open_id_providers": [
            {"iss": "https://accounts.google.com", "certs_url": "https://www.googleapis.com/oauth2/v3/certs"}
        ],
        "dkim_targets": [
            {"domain": "gmail.com", "selector": "20230601"}
        ],
        "chain": {
            "rpc_url": "https://rpc.example.com",
            "dkim_keys_contract": "0x0000000000000000000000000000000000000aaa",
            "open_id_keys_contract": "0x0000000000000000000000000000000000000bbb"
        }
    }"#;

    #[test]
    fn parses_sample() {
        let cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(cfg.certs_check_interval_secs, 600);
        assert_eq!(cfg.open_id_providers.len(), 1);
        assert_eq!(cfg.dkim_targets[0].selector, "20230601");
        assert_eq!(cfg.chain.max_block_range, 10_000);
        cfg.validate().unwrap();
    }

    #[test]
    fn applies_defaults() {
        let mut v: serde_json::Value = serde_json::from_str(SAMPLE).unwrap();
        let obj = v.as_object_mut().unwrap();
        obj.remove("certs_check_interval_secs");
        obj.remove("chain_check_interval_secs");
        obj.remove("check_chain_sync");
        let src = serde_json::to_string(&v).unwrap();
        let cfg: Config = serde_json::from_str(&src).unwrap();
        assert_eq!(cfg.certs_check_interval_secs, 3600);
        assert_eq!(cfg.chain_check_interval_secs, 300);
        assert!(cfg.check_chain_sync);
    }

    #[test]
    fn tls_type_lowercase_match_elf_rodata() {
        // The ELF stores the value as a lowercase token — any other
        // spelling will fail to round-trip against a production config.
        assert_eq!(serde_json::to_string(&TlsType::Tls).unwrap(), "\"tls\"");
        assert_eq!(serde_json::to_string(&TlsType::StartTls).unwrap(), "\"starttls\"");
        assert_eq!(serde_json::to_string(&TlsType::None).unwrap(), "\"none\"");
    }

    #[test]
    fn validates_slack_url_scheme() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.slack_webhook_url = "ftp://nope".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn validates_intervals_nonzero() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.certs_check_interval_secs = 0;
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
        let mut cfg2: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg2.chain_check_interval_secs = 0;
        assert!(matches!(cfg2.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn validates_at_least_one_target() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.open_id_providers.clear();
        cfg.dkim_targets.clear();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn validates_oidc_https_only() {
        let mut cfg: Config = serde_json::from_str(SAMPLE).unwrap();
        cfg.open_id_providers[0].iss = "http://accounts.google.com".into();
        assert!(matches!(cfg.validate(), Err(ConfigError::Validation(_))));
    }

    #[test]
    fn loads_from_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), SAMPLE).unwrap();
        let cfg = Config::from_path(tmp.path()).unwrap();
        assert_eq!(cfg.dkim_targets[0].domain, "gmail.com");
    }

    #[test]
    fn load_missing_file_is_io_error() {
        assert!(matches!(
            Config::from_path(Path::new("/not/here.json")),
            Err(ConfigError::Io { .. })
        ));
    }

    #[test]
    fn load_malformed_is_parse_error() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), "{ not json").unwrap();
        assert!(matches!(
            Config::from_path(tmp.path()),
            Err(ConfigError::Parse(_))
        ));
    }
}
