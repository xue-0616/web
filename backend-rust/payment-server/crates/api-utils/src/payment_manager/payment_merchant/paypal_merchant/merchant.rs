use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Thread-safe cached token with expiry tracking (CRIT-01 fix)
struct CachedToken {
    access_token: String,
    /// When the token expires (with 60s safety margin)
    expires_at: std::time::Instant,
}

pub struct PayPalMerchant {
    api_url: String,
    client_id: String,
    client_secret: String,
    client: reqwest::Client,
    /// Thread-safe token cache with automatic expiry (CRIT-01 fix)
    token_cache: Arc<RwLock<Option<CachedToken>>>,
}

#[derive(Debug, Deserialize)]
pub struct PayPalTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
}

impl PayPalMerchant {
    pub fn new(api_url: &str, client_id: &str, client_secret: &str) -> Self {
        Self {
            api_url: api_url.to_string(),
            client_id: client_id.to_string(),
            client_secret: client_secret.to_string(),
            client: reqwest::Client::new(),
            token_cache: Arc::new(RwLock::new(None)),
        }
    }

    /// Get OAuth2 access token — thread-safe with expiry tracking (CRIT-01 fix)
    pub async fn authenticate(&self) -> Result<()> {
        let resp = self.client
            .post(format!("{}/v1/oauth2/token", self.api_url))
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .form(&[("grant_type", "client_credentials")])
            .send().await?;

        // HIGH-01 fix: check HTTP status before deserializing
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("PayPal OAuth2 token request failed (HTTP {}): {}", status, body);
        }

        let token_resp: PayPalTokenResponse = resp.json().await?;
        // Subtract 60 seconds safety margin from token lifetime
        let expires_at = std::time::Instant::now()
            + std::time::Duration::from_secs(token_resp.expires_in.saturating_sub(60));

        let mut cache = self.token_cache.write().await;
        *cache = Some(CachedToken {
            access_token: token_resp.access_token,
            expires_at,
        });

        tracing::info!("PayPal OAuth2 token refreshed, expires in {}s", token_resp.expires_in);
        Ok(())
    }

    /// Get a valid access token, auto-refreshing if expired or missing (CRIT-01 fix)
    async fn get_valid_token(&self) -> Result<String> {
        // Fast path: check if we have a valid cached token
        {
            let cache = self.token_cache.read().await;
            if let Some(ref cached) = *cache {
                if std::time::Instant::now() < cached.expires_at {
                    return Ok(cached.access_token.clone());
                }
            }
        }

        // Slow path: token missing or expired, re-authenticate
        tracing::info!("PayPal token missing or expired, re-authenticating");
        self.authenticate().await?;

        let cache = self.token_cache.read().await;
        cache.as_ref()
            .map(|c| c.access_token.clone())
            .ok_or_else(|| anyhow::anyhow!("Failed to obtain PayPal access token after authentication"))
    }

    /// Create PayPal order — with automatic re-authentication on token expiry (CRIT-01 fix)
    pub async fn create_order(&self, amount: &str, currency: &str) -> Result<serde_json::Value> {
        let token = self.get_valid_token().await?;
        let body = serde_json::json!({
            "intent": "CAPTURE",
            "purchase_units": [{"amount": {"currency_code": currency, "value": amount}}]
        });

        let resp = self.client
            .post(format!("{}/v2/checkout/orders", self.api_url))
            .bearer_auth(&token)
            .json(&body)
            .send().await?;

        // HIGH-01 fix: validate HTTP response status
        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();

            // If 401 Unauthorized, try re-auth once and retry
            if status == reqwest::StatusCode::UNAUTHORIZED {
                tracing::warn!("PayPal create_order got 401, re-authenticating and retrying");
                self.authenticate().await?;
                let new_token = self.get_valid_token().await?;
                let retry_resp = self.client
                    .post(format!("{}/v2/checkout/orders", self.api_url))
                    .bearer_auth(&new_token)
                    .json(&body)
                    .send().await?;
                if !retry_resp.status().is_success() {
                    let retry_status = retry_resp.status();
                    let retry_body = retry_resp.text().await.unwrap_or_default();
                    anyhow::bail!("PayPal create_order failed after re-auth (HTTP {}): {}", retry_status, retry_body);
                }
                return Ok(retry_resp.json().await?);
            }

            anyhow::bail!("PayPal create_order failed (HTTP {}): {}", status, err_body);
        }

        Ok(resp.json().await?)
    }
}
