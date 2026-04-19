use anyhow::Result;

/// Submits signed EVM transactions via RPC (HIGH-04 fix: check for RPC errors)
pub async fn submit_to_chain(rpc_url: &str, signed_tx: &[u8]) -> Result<String> {
    let client = reqwest::Client::new();
    let tx_hex = format!("0x{}", hex::encode(signed_tx));
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_sendRawTransaction",
        "params": [tx_hex]
    });

    let resp_raw = client.post(rpc_url).json(&body).send().await?;

    // HIGH-01 fix: check HTTP status
    if !resp_raw.status().is_success() {
        let status = resp_raw.status();
        let err_body = resp_raw.text().await.unwrap_or_default();
        anyhow::bail!("RPC HTTP error ({}): {}", status, err_body);
    }

    let resp: serde_json::Value = resp_raw.json().await?;

    // HIGH-04 fix: Check for JSON-RPC error response before reading result
    if let Some(error) = resp.get("error") {
        let code = error.get("code").and_then(|c| c.as_i64()).unwrap_or(0);
        let message = error.get("message").and_then(|m| m.as_str()).unwrap_or("unknown RPC error");
        anyhow::bail!("RPC error (code {}): {}", code, message);
    }

    // Extract the transaction hash from the result
    let hash = resp["result"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("RPC response missing 'result' field: {}", resp))?;

    if hash.is_empty() {
        anyhow::bail!("RPC returned empty transaction hash");
    }

    Ok(hash.to_string())
}
