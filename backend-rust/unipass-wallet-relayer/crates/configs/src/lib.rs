use serde::Deserialize;

/// RelayerConfig — loaded from environment variables.
///
/// SECURITY: `relayer_private_key` is stored as a plain String here only for
/// deserialization.  Callers MUST wrap it in `SecurePrivateKey` (see security module)
/// immediately after loading, and remove the env var.
#[derive(Clone, Deserialize, Default)]
pub struct RelayerConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    /// Apollo config endpoint (optional)
    #[serde(default)]
    pub apollo_url: String,
    /// SECRET_PATH for additional secrets
    #[serde(default)]
    pub secret_path: String,
    /// EVM RPC URLs per chain
    #[serde(default)]
    pub arbitrum_rpc_url: String,
    #[serde(default)]
    pub polygon_rpc_url: String,
    #[serde(default)]
    pub bsc_rpc_url: String,
    #[serde(default)]
    pub ethereum_rpc_url: String,
    /// Relayer private key (hex) — NEVER log this value
    #[serde(default)]
    pub relayer_private_key: String,
    #[serde(default)]
    pub slack_webhook: String,
}

fn default_port() -> u16 { 8084 }

// Custom Debug impl that redacts sensitive fields
impl std::fmt::Debug for RelayerConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RelayerConfig")
            .field("port", &self.port)
            .field("database_url", &"[REDACTED]")
            .field("redis_url", &"[REDACTED]")
            .field("apollo_url", &self.apollo_url)
            .field("arbitrum_rpc_url", &self.arbitrum_rpc_url)
            .field("polygon_rpc_url", &self.polygon_rpc_url)
            .field("bsc_rpc_url", &self.bsc_rpc_url)
            .field("ethereum_rpc_url", &self.ethereum_rpc_url)
            .field("relayer_private_key", &"[REDACTED]")
            .field("slack_webhook", &"[REDACTED]")
            .finish()
    }
}

/// Load config from env + optional Apollo + SECRET_PATH.
///
/// MED-RL-4: the previous implementation fetched the Apollo JSON,
/// logged its length, and threw the response on the floor. Every
/// operator that expected "Apollo overrides env" got the opposite
/// (env silently won) with no warning indicating it.
///
/// Fix: the keys Apollo returns ARE now merged into `config`. We
/// only merge a small allow-list of known overridable fields — RPC
/// URLs, port, slack webhook — NOT `relayer_private_key`,
/// `database_url`, or `redis_url`, which must come from the
/// container environment (and often from a secret store, not plain
/// env). Apollo has weaker ACLs than the container env in most
/// deployments; limiting the merge surface keeps the secret plane
/// out of Apollo's blast radius.
pub async fn load_config() -> anyhow::Result<RelayerConfig> {
    let mut config: RelayerConfig = envy::from_env()?;

    if !config.apollo_url.is_empty() {
        let apollo_url = format!(
            "{}/configfiles/json/wallet-relayer/default/application",
            &config.apollo_url
        );
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()?;
        match client.get(&apollo_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(items) = resp
                    .json::<std::collections::HashMap<String, String>>()
                    .await
                {
                    let applied = apply_apollo_overrides(&mut config, &items);
                    tracing::info!(
                        "Apollo: received {} keys, applied {} overrides",
                        items.len(),
                        applied
                    );
                } else {
                    tracing::warn!("Apollo response was not a JSON map — ignored");
                }
            }
            Ok(resp) => {
                tracing::warn!(
                    "Apollo returned HTTP {} — keeping env-only config",
                    resp.status()
                );
            }
            Err(e) => {
                tracing::warn!("Apollo fetch error ({}) — keeping env-only config", e);
            }
        }
    }

    Ok(config)
}

/// Merge a fetched-from-Apollo key/value map into the config.
///
/// The allow-list is deliberately narrow. Secrets
/// (`relayer_private_key`), infra endpoints with credentials
/// (`database_url`, `redis_url`), and the Apollo URL itself are
/// NOT overridable — Apollo is a configuration channel, not a
/// secrets channel. Trying to override them is logged at WARN
/// level so an operator who expects it to work finds out quickly.
///
/// Returns the number of fields actually updated.
fn apply_apollo_overrides(
    config: &mut RelayerConfig,
    items: &std::collections::HashMap<String, String>,
) -> usize {
    const SECRET_OR_INFRA: &[&str] = &[
        "relayer_private_key",
        "database_url",
        "redis_url",
        "apollo_url",
        "secret_path",
    ];

    let mut applied = 0usize;
    for (key, value) in items {
        let k = key.to_lowercase();
        if SECRET_OR_INFRA.contains(&k.as_str()) {
            tracing::warn!(
                "Apollo attempted to override reserved field `{}`; ignored. Set it via env/secret store only.",
                k
            );
            continue;
        }
        match k.as_str() {
            "port" => {
                if let Ok(p) = value.parse::<u16>() {
                    config.port = p;
                    applied += 1;
                } else {
                    tracing::warn!("Apollo: invalid `port` value {:?}; ignored", value);
                }
            }
            "arbitrum_rpc_url" => {
                config.arbitrum_rpc_url = value.clone();
                applied += 1;
            }
            "polygon_rpc_url" => {
                config.polygon_rpc_url = value.clone();
                applied += 1;
            }
            "bsc_rpc_url" => {
                config.bsc_rpc_url = value.clone();
                applied += 1;
            }
            "ethereum_rpc_url" => {
                config.ethereum_rpc_url = value.clone();
                applied += 1;
            }
            "slack_webhook" => {
                config.slack_webhook = value.clone();
                applied += 1;
            }
            _ => {
                tracing::debug!("Apollo: unknown key `{}`; ignored", key);
            }
        }
    }
    applied
}

#[cfg(test)]
mod tests {
    //! MED-RL-4 tests cover the `apply_apollo_overrides` helper
    //! — the network-fetching `load_config` is not exercised here
    //! because it reads the process env and is better covered by
    //! an integration test.
    use super::*;
    use std::collections::HashMap;

    fn base() -> RelayerConfig {
        RelayerConfig {
            port: 8084,
            database_url: "mysql://…".into(),
            redis_url: "redis://…".into(),
            apollo_url: "http://apollo:8080".into(),
            secret_path: "".into(),
            arbitrum_rpc_url: "env-arb".into(),
            polygon_rpc_url: "env-poly".into(),
            bsc_rpc_url: "env-bsc".into(),
            ethereum_rpc_url: "env-eth".into(),
            relayer_private_key: "do-not-override-me".into(),
            slack_webhook: "env-slack".into(),
        }
    }

    #[test]
    fn overrides_rpc_urls_and_port() {
        let mut c = base();
        let mut items = HashMap::new();
        items.insert("port".to_string(), "9000".to_string());
        items.insert("arbitrum_rpc_url".to_string(), "apollo-arb".to_string());
        items.insert("ethereum_rpc_url".to_string(), "apollo-eth".to_string());
        let n = apply_apollo_overrides(&mut c, &items);
        assert_eq!(n, 3);
        assert_eq!(c.port, 9000);
        assert_eq!(c.arbitrum_rpc_url, "apollo-arb");
        assert_eq!(c.ethereum_rpc_url, "apollo-eth");
        // untouched
        assert_eq!(c.polygon_rpc_url, "env-poly");
    }

    #[test]
    fn refuses_to_override_private_key_and_infra() {
        let mut c = base();
        let mut items = HashMap::new();
        items.insert(
            "relayer_private_key".to_string(),
            "ATTACKER_CONTROLLED".to_string(),
        );
        items.insert(
            "database_url".to_string(),
            "mysql://attacker:bad@evil/".to_string(),
        );
        items.insert("redis_url".to_string(), "redis://evil".to_string());
        items.insert(
            "apollo_url".to_string(),
            "http://attacker:bad@evil".to_string(),
        );
        let n = apply_apollo_overrides(&mut c, &items);
        assert_eq!(n, 0, "no reserved field may be applied");
        assert_eq!(c.relayer_private_key, "do-not-override-me");
        assert!(c.database_url.starts_with("mysql://…"));
        assert!(c.redis_url.starts_with("redis://…"));
        assert_eq!(c.apollo_url, "http://apollo:8080");
    }

    #[test]
    fn port_rejects_garbage() {
        let mut c = base();
        let mut items = HashMap::new();
        items.insert("port".to_string(), "not-a-number".to_string());
        let n = apply_apollo_overrides(&mut c, &items);
        assert_eq!(n, 0);
        assert_eq!(c.port, 8084, "port must stay at env value on parse failure");
    }

    #[test]
    fn keys_are_case_insensitive() {
        let mut c = base();
        let mut items = HashMap::new();
        items.insert(
            "ARBITRUM_RPC_URL".to_string(),
            "apollo-arb-upper".to_string(),
        );
        let n = apply_apollo_overrides(&mut c, &items);
        assert_eq!(n, 1);
        assert_eq!(c.arbitrum_rpc_url, "apollo-arb-upper");
    }
}
