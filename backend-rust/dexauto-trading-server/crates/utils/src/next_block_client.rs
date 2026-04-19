use anyhow::Result;
use serde::{Deserialize, Serialize};

/// NextBlock MEV protection client
/// Sends transactions via NextBlock's private mempool
pub struct NextBlockClient {
    endpoint: String,
    api_key: String,
}

#[derive(Serialize)]
struct SendBundleRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: Vec<serde_json::Value>,
}

impl NextBlockClient {
    pub fn new(endpoint: &str, api_key: &str) -> Self {
        Self {
            endpoint: endpoint.to_string(),
            api_key: api_key.to_string(),
        }
    }

    /// Send transaction via NextBlock's private channel (MEV protected)
    pub async fn send_transaction(&self, tx_base64: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let req = SendBundleRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "sendTransaction".to_string(),
            params: vec![serde_json::json!(tx_base64)],
        };

        let resp: serde_json::Value = client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&req)
            .send()
            .await?
            .json()
            .await?;

        let sig = resp["result"].as_str().unwrap_or("").to_string();
        Ok(sig)
    }
}
