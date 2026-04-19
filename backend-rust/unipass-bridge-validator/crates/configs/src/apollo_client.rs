/// Apollo configuration client for dynamic config fetching.
/// If `apollo_url` is not configured, this client is a no-op.
/// Config values fetched from Apollo are validated before use.

use anyhow::Result;

pub struct ApolloClient {
    base_url: String,
    client: reqwest::Client,
}

impl ApolloClient {
    /// Create a new Apollo client. Returns None if base_url is empty (disabled).
    pub fn new(base_url: &str) -> Option<Self> {
        if base_url.is_empty() {
            tracing::info!("Apollo config client disabled (no APOLLO_URL configured)");
            return None;
        }
        tracing::info!("Apollo config client initialized: {}", base_url);
        Some(Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::new(),
        })
    }

    /// Fetch a configuration value from Apollo by key.
    /// Returns None if the key doesn't exist or the request fails.
    pub async fn get_config(&self, namespace: &str, key: &str) -> Result<Option<String>> {
        let url = format!(
            "{}/configs/{}/default/{}",
            self.base_url, namespace, key
        );
        let resp = self.client.get(&url).send().await?;
        if resp.status().is_success() {
            let body: serde_json::Value = resp.json().await?;
            let result = body
                .get("value")
                .and_then(|v: &serde_json::Value| v.as_str())
                .map(|s: &str| s.to_string());
            Ok(result)
        } else {
            tracing::warn!("Apollo config fetch failed for {}/{}: {}", namespace, key, resp.status());
            Ok(None)
        }
    }

    /// Fetch supported chains list from Apollo (if configured).
    pub async fn fetch_supported_chains(&self) -> Result<Option<Vec<u64>>> {
        if let Some(val) = self.get_config("bridge", "supported_chains").await? {
            let chains: Vec<u64> = val
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect();
            Ok(Some(chains))
        } else {
            Ok(None)
        }
    }

    /// Fetch token whitelist from Apollo (if configured).
    pub async fn fetch_token_whitelist(&self) -> Result<Option<Vec<String>>> {
        if let Some(val) = self.get_config("bridge", "token_whitelist").await? {
            let tokens: Vec<String> = val
                .split(',')
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty())
                .collect();
            Ok(Some(tokens))
        } else {
            Ok(None)
        }
    }
}
