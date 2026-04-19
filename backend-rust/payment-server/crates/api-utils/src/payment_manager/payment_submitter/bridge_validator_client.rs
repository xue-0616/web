use anyhow::Result;
use serde::{Deserialize, Serialize};

/// FINDING-21: Proper response types for bridge-validator service.
/// Ensures structured deserialization and validation of responses.

#[derive(Debug, Deserialize, Serialize)]
pub struct PaymentSubmitResponse {
    pub payment_id: String,
    pub status: String,
    #[serde(default)]
    pub tx_hash: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PaymentStatusResponse {
    pub status: String,
    #[serde(default)]
    pub confirmations: Option<u64>,
    #[serde(default)]
    pub tx_hash: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

/// Valid payment statuses from bridge-validator
const VALID_STATUSES: &[&str] = &["pending", "validating", "validated", "submitted", "confirmed", "failed"];

/// Client for unipass-bridge-validator service
pub struct BridgeValidatorClient {
    base_url: String,
    client: reqwest::Client,
}

impl BridgeValidatorClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    /// Submit payment for cross-chain validation
    pub async fn submit_payment(&self, payment_data: &serde_json::Value) -> Result<PaymentSubmitResponse> {
        let http_resp = self.client
            .post(format!("{}/api/v1/payment", self.base_url))
            .json(payment_data)
            .send().await?;

        let status_code = http_resp.status();
        if !status_code.is_success() {
            let body = http_resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "Bridge validator returned HTTP {}: {}",
                status_code, body
            );
        }

        let resp: PaymentSubmitResponse = http_resp.json().await
            .map_err(|e| anyhow::anyhow!("Failed to parse bridge validator response: {}", e))?;

        // Validate status field
        if !VALID_STATUSES.contains(&resp.status.as_str()) {
            anyhow::bail!(
                "Bridge validator returned unknown status: '{}' (expected one of: {:?})",
                resp.status, VALID_STATUSES
            );
        }

        Ok(resp)
    }

    /// Check payment validation status
    pub async fn get_payment_status(&self, payment_id: &str) -> Result<PaymentStatusResponse> {
        let http_resp = self.client
            .get(format!("{}/api/v1/payment/status", self.base_url))
            .query(&[("id", payment_id)])
            .send().await?;

        let status_code = http_resp.status();
        if !status_code.is_success() {
            let body = http_resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "Bridge validator status check returned HTTP {}: {}",
                status_code, body
            );
        }

        let resp: PaymentStatusResponse = http_resp.json().await
            .map_err(|e| anyhow::anyhow!("Failed to parse bridge validator status response: {}", e))?;

        // Validate status field
        if !VALID_STATUSES.contains(&resp.status.as_str()) {
            anyhow::bail!(
                "Bridge validator returned unknown status: '{}' (expected one of: {:?})",
                resp.status, VALID_STATUSES
            );
        }

        Ok(resp)
    }
}
