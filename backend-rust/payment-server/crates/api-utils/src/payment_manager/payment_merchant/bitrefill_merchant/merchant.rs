use anyhow::Result;
use serde::{Deserialize, Serialize};

pub struct BitrefillMerchant {
    api_url: String,
    api_key: String,
    api_secret: String,
    client: reqwest::Client,
}

impl BitrefillMerchant {
    pub fn new(api_url: &str, api_key: &str, api_secret: &str) -> Self {
        Self {
            api_url: api_url.to_string(),
            api_key: api_key.to_string(),
            api_secret: api_secret.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Search gift cards (HIGH-01 fix: validate HTTP status)
    pub async fn search_products(&self, query: &str, country: &str) -> Result<serde_json::Value> {
        let resp = self.client
            .get(format!("{}/v2/products", self.api_url))
            .basic_auth(&self.api_key, Some(&self.api_secret))
            .query(&[("query", query), ("country", country)])
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Bitrefill search_products failed (HTTP {}): {}", status, err_body);
        }

        Ok(resp.json().await?)
    }

    /// Create gift card order (HIGH-01 fix: validate HTTP status)
    pub async fn create_order(&self, product_id: &str, value: f64, quantity: u32) -> Result<serde_json::Value> {
        let body = serde_json::json!({
            "productId": product_id,
            "value": value,
            "quantity": quantity,
        });
        let resp = self.client
            .post(format!("{}/v2/orders", self.api_url))
            .basic_auth(&self.api_key, Some(&self.api_secret))
            .json(&body)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Bitrefill create_order failed (HTTP {}): {}", status, err_body);
        }

        Ok(resp.json().await?)
    }
}
