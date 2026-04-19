use anyhow::Result;
use api_common::context::AppContext;

/// Submit signed CKB transaction to RPC
pub async fn submit_tx(ctx: &AppContext, tx_bytes: &[u8]) -> Result<String> {
    let client = reqwest::Client::new();
    let rpc_body = serde_json::json!({
        "id": 1, "jsonrpc": "2.0",
        "method": "send_transaction",
        "params": [format!("0x{}", hex::encode(tx_bytes)), "passthrough"]
    });
    let resp = client.post(&ctx.config.ckb_rpc_url).json(&rpc_body).send().await?;
    let result: serde_json::Value = resp.json().await?;
    if let Some(err) = result.get("error") {
        anyhow::bail!("CKB RPC rejected tx: {}", err);
    }
    let tx_hash = result["result"].as_str().unwrap_or("0x").to_string();
    tracing::info!("Farm tx submitted: {}", tx_hash);
    Ok(tx_hash)
}
