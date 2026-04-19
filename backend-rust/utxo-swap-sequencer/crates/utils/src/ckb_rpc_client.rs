use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// CKB JSON-RPC client
pub struct CkbRpcClient {
    url: String,
    client: reqwest::Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcResponse<T> {
    pub jsonrpc: String,
    pub id: u64,
    pub result: Option<T>,
    pub error: Option<RpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i64,
    pub message: String,
}

impl CkbRpcClient {
    pub fn new(url: &str) -> Self {
        Self {
            url: url.to_string(),
            client: reqwest::Client::new(),
        }
    }

    async fn call<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<T> {
        let body = json!({
            "id": 1,
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });

        let resp: RpcResponse<T> = self
            .client
            .post(&self.url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;

        if let Some(err) = resp.error {
            anyhow::bail!("CKB RPC error {}: {}", err.code, err.message);
        }

        resp.result
            .ok_or_else(|| anyhow::anyhow!("CKB RPC: empty result"))
    }

    /// Get tip block number
    pub async fn get_tip_block_number(&self) -> Result<u64> {
        let result: String = self.call("get_tip_block_number", json!([])).await?;
        let num = u64::from_str_radix(result.trim_start_matches("0x"), 16)?;
        Ok(num)
    }

    /// Send transaction
    pub async fn send_transaction(
        &self,
        tx: serde_json::Value,
    ) -> Result<String> {
        let tx_hash: String = self
            .call("send_transaction", json!([tx, "passthrough"]))
            .await?;
        Ok(tx_hash)
    }

    /// Get transaction status
    pub async fn get_transaction(
        &self,
        tx_hash: &str,
    ) -> Result<Option<serde_json::Value>> {
        let result: Option<serde_json::Value> = self
            .call("get_transaction", json!([tx_hash]))
            .await?;
        Ok(result)
    }

    /// Get cells by lock script hash using indexer
    pub async fn get_cells(
        &self,
        search_key: serde_json::Value,
        order: &str,
        limit: u64,
        cursor: Option<String>,
    ) -> Result<serde_json::Value> {
        let params = json!([
            search_key,
            order,
            format!("0x{:x}", limit),
            cursor,
        ]);
        let result: serde_json::Value = self.call("get_cells", params).await?;
        Ok(result)
    }

    /// Get fee rate statistics
    pub async fn get_fee_rate_statistics(&self) -> Result<Option<serde_json::Value>> {
        self.call("get_fee_rate_statistics", json!([])).await
    }
}
