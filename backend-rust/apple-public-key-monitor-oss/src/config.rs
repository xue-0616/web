//! Environment-variable config.

use std::{path::PathBuf, time::Duration};

#[derive(Debug, Clone)]
pub struct Config {
    pub apple_keys_url: String,
    pub slack_webhook_url: String,
    pub poll_interval: Duration,
    pub state_file: PathBuf,
    pub http_timeout: Duration,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("missing required env var: {0}")]
    MissingVar(&'static str),
    #[error("invalid {var}: {value} ({reason})")]
    Invalid {
        var: &'static str,
        value: String,
        reason: String,
    },
}

impl Config {
    /// Load from env vars. `SLACK_WEBHOOK_URL` is mandatory; everything else
    /// has a sensible default.
    pub fn from_env() -> Result<Self, ConfigError> {
        let slack_webhook_url = std::env::var("SLACK_WEBHOOK_URL")
            .map_err(|_| ConfigError::MissingVar("SLACK_WEBHOOK_URL"))?;

        // Defensive: reject empty strings because `var()` returns Ok("")
        // when the var is set but blank.
        if slack_webhook_url.is_empty() {
            return Err(ConfigError::MissingVar("SLACK_WEBHOOK_URL"));
        }

        let apple_keys_url = std::env::var("APPLE_KEYS_URL")
            .unwrap_or_else(|_| "https://appleid.apple.com/auth/keys".into());

        let poll_interval = parse_secs("POLL_INTERVAL_SECS", 300)?;
        let http_timeout = parse_secs("HTTP_TIMEOUT_SECS", 30)?;

        let state_file = std::env::var("STATE_FILE")
            .unwrap_or_else(|_| "./apple-keys.state.json".into())
            .into();

        Ok(Self {
            apple_keys_url,
            slack_webhook_url,
            poll_interval,
            state_file,
            http_timeout,
        })
    }
}

fn parse_secs(var: &'static str, default: u64) -> Result<Duration, ConfigError> {
    match std::env::var(var) {
        Err(_) => Ok(Duration::from_secs(default)),
        Ok(raw) => {
            let secs: u64 = raw.parse().map_err(|e: std::num::ParseIntError| ConfigError::Invalid {
                var,
                value: raw.clone(),
                reason: e.to_string(),
            })?;
            if secs == 0 {
                return Err(ConfigError::Invalid {
                    var,
                    value: raw,
                    reason: "must be > 0".into(),
                });
            }
            Ok(Duration::from_secs(secs))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // `std::env::set_var` is process-global; serialise config tests.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn cleanup() {
        for v in [
            "APPLE_KEYS_URL",
            "SLACK_WEBHOOK_URL",
            "POLL_INTERVAL_SECS",
            "HTTP_TIMEOUT_SECS",
            "STATE_FILE",
        ] {
            // SAFETY: tests serialise on ENV_LOCK so no concurrent reader.
            unsafe { std::env::remove_var(v) };
        }
    }

    #[test]
    fn rejects_missing_webhook() {
        let _g = ENV_LOCK.lock().unwrap();
        cleanup();
        assert!(matches!(
            Config::from_env(),
            Err(ConfigError::MissingVar("SLACK_WEBHOOK_URL"))
        ));
    }

    #[test]
    fn rejects_empty_webhook() {
        let _g = ENV_LOCK.lock().unwrap();
        cleanup();
        unsafe { std::env::set_var("SLACK_WEBHOOK_URL", "") };
        assert!(matches!(
            Config::from_env(),
            Err(ConfigError::MissingVar("SLACK_WEBHOOK_URL"))
        ));
        cleanup();
    }

    #[test]
    fn applies_defaults() {
        let _g = ENV_LOCK.lock().unwrap();
        cleanup();
        unsafe { std::env::set_var("SLACK_WEBHOOK_URL", "https://hooks.slack.com/x") };
        let c = Config::from_env().unwrap();
        assert_eq!(c.apple_keys_url, "https://appleid.apple.com/auth/keys");
        assert_eq!(c.poll_interval, Duration::from_secs(300));
        assert_eq!(c.http_timeout, Duration::from_secs(30));
        assert_eq!(c.state_file.to_string_lossy(), "./apple-keys.state.json");
        cleanup();
    }

    #[test]
    fn overrides_via_env() {
        let _g = ENV_LOCK.lock().unwrap();
        cleanup();
        unsafe {
            std::env::set_var("SLACK_WEBHOOK_URL", "https://hooks/x");
            std::env::set_var("APPLE_KEYS_URL", "https://alt/");
            std::env::set_var("POLL_INTERVAL_SECS", "60");
            std::env::set_var("HTTP_TIMEOUT_SECS", "5");
            std::env::set_var("STATE_FILE", "/tmp/x.json");
        }
        let c = Config::from_env().unwrap();
        assert_eq!(c.apple_keys_url, "https://alt/");
        assert_eq!(c.poll_interval, Duration::from_secs(60));
        assert_eq!(c.http_timeout, Duration::from_secs(5));
        assert_eq!(c.state_file.to_string_lossy(), "/tmp/x.json");
        cleanup();
    }

    #[test]
    fn rejects_zero_poll_interval() {
        let _g = ENV_LOCK.lock().unwrap();
        cleanup();
        unsafe {
            std::env::set_var("SLACK_WEBHOOK_URL", "https://hooks/x");
            std::env::set_var("POLL_INTERVAL_SECS", "0");
        }
        assert!(matches!(
            Config::from_env(),
            Err(ConfigError::Invalid { var: "POLL_INTERVAL_SECS", .. })
        ));
        cleanup();
    }
}
