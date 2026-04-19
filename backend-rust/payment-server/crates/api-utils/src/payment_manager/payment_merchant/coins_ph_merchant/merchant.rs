use anyhow::Result;

/// Coins.ph merchant — PHP fiat on/off ramp (Philippines)
pub struct CoinsPhMerchant {
    api_url: String,
    api_key: String,
    client: reqwest::Client,
}

impl CoinsPhMerchant {
    pub fn new(api_url: &str, api_key: &str) -> Self {
        Self { api_url: api_url.to_string(), api_key: api_key.to_string(), client: reqwest::Client::new() }
    }

    /// Create payout (HIGH-01 fix: validate HTTP status)
    pub async fn create_payout(&self, amount: &str, account: &str) -> Result<serde_json::Value> {
        let resp = self.client.post(format!("{}/transfers/send", self.api_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&serde_json::json!({"amount": amount, "target_address": account, "currency": "PHP"}))
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("CoinsPh create_payout failed (HTTP {}): {}", status, err_body);
        }

        Ok(resp.json().await?)
    }
}
