use anyhow::Result;
use serde::{Deserialize, Serialize};

pub struct CoinsMerchant {
    api_url: String,
    api_key: String,
    client: reqwest::Client,
}

impl CoinsMerchant {
    pub fn new(api_url: &str, api_key: &str) -> Self {
        Self {
            api_url: api_url.to_string(),
            api_key: api_key.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Create off-ramp (sell crypto → fiat PHP) payout (HIGH-01 fix: validate HTTP status)
    pub async fn create_payout(&self, amount: &str, bank_code: &str, account_no: &str) -> Result<serde_json::Value> {
        let body = serde_json::json!({
            "amount": amount,
            "currency": "PHP",
            "bank_code": bank_code,
            "account_number": account_no,
        });
        let resp = self.client
            .post(format!("{}/api/v2/payouts", self.api_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Coins create_payout failed (HTTP {}): {}", status, err_body);
        }

        Ok(resp.json().await?)
    }
}
