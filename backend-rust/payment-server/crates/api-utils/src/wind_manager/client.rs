use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Wind off-ramp API client
pub struct WindClient {
    api_url: String,
    api_key: String,
    client: reqwest::Client,
}

impl WindClient {
    pub fn new(api_url: &str, api_key: &str) -> Self {
        Self {
            api_url: api_url.to_string(),
            api_key: api_key.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Create off-ramp order (HIGH-01 fix: validate HTTP status)
    pub async fn create_off_ramp_order(&self, params: &serde_json::Value) -> Result<serde_json::Value> {
        let resp = self.client
            .post(format!("{}/v1/off-ramp/orders", self.api_url))
            .header("x-api-key", &self.api_key)
            .json(params)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Wind create_off_ramp_order failed (HTTP {}): {}", status, err_body);
        }

        Ok(resp.json().await?)
    }

    /// Get order status (HIGH-01 fix: validate HTTP status)
    pub async fn get_order_status(&self, order_id: &str) -> Result<serde_json::Value> {
        let resp = self.client
            .get(format!("{}/v1/off-ramp/orders/{}", self.api_url, order_id))
            .header("x-api-key", &self.api_key)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Wind get_order_status failed (HTTP {}): {}", status, err_body);
        }

        Ok(resp.json().await?)
    }
}
