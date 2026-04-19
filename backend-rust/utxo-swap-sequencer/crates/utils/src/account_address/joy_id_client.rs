/// JoyID API client
/// Endpoints from binary: https://api.joy.id (mainnet), https://api.testnet.joyid.dev (testnet)
pub struct JoyIdClient {
    url: String,
    client: reqwest::Client,
}

impl JoyIdClient {
    pub fn new(is_mainnet: bool) -> Self {
        let url = if is_mainnet {
            "https://api.joy.id".to_string()
        } else {
            "https://api.testnet.joyid.dev".to_string()
        };
        Self {
            url,
            client: reqwest::Client::new(),
        }
    }

    /// Verify JoyID WebAuthn signature
    pub async fn verify_signature(
        &self,
        pubkey: &str,
        message: &str,
        signature: &str,
    ) -> anyhow::Result<bool> {
        // Call JoyID API to verify WebAuthn P-256 signature
        let resp = self.client.post(format!("{}/api/v1/verify", self.url))
            .json(&serde_json::json!({
                "pubkey": pubkey,
                "message": message,
                "signature": signature,
            }))
            .send().await?;
        let result: serde_json::Value = resp.json().await?;
        let valid = result["valid"].as_bool().unwrap_or(false);
        Ok(valid)
    }
}
