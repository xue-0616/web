use anyhow::Result;

/// Manages EVM transaction lifecycle for payment server
pub struct TransactionManager {
    pub rpc_url: String,
    pub chain_id: u64,
}

impl TransactionManager {
    pub fn new(rpc_url: &str, chain_id: u64) -> Self {
        Self { rpc_url: rpc_url.to_string(), chain_id }
    }

    /// Submit a transaction to the EVM chain
    pub async fn submit_transaction(
        &self,
        to: &str,
        data: &[u8],
        value: &str,
    ) -> Result<String> {
        // Build EVM transaction JSON
        let tx = serde_json::json!({
            "to": to,
            "data": format!("0x{}", hex::encode(data)),
            "value": value,
            "chainId": format!("0x{:x}", self.chain_id),
        });
        tracing::info!("Submitting EVM tx to chain {}: to={}", self.chain_id, to);
        // In production: sign with relayer key, submit via eth_sendRawTransaction
        Ok(format!("pending-{}", hex::encode(&data[..4.min(data.len())])))
    }

    /// Check transaction receipt
    pub async fn get_receipt(&self, tx_hash: &str) -> Result<Option<serde_json::Value>> {
        let client = reqwest::Client::new();
        let resp = client.post(&self.rpc_url)
            .json(&serde_json::json!({
                "id": 1, "jsonrpc": "2.0",
                "method": "eth_getTransactionReceipt",
                "params": [tx_hash]
            }))
            .send().await?;
        let body: serde_json::Value = resp.json().await?;
        Ok(body.get("result").cloned())
    }
}
