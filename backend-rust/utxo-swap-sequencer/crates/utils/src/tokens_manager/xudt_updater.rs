use api_common::context::AppContext;

/// Scan CKB indexer for new xUDT type scripts and register them
pub async fn scan_xudt_tokens(ctx: &AppContext) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    let indexer_url = &ctx.config.ckb_indexer_url;

    // Search for cells with xUDT type script code_hash
    let xudt_code_hash = "0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609571a33571996";
    let request_body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "get_cells",
        "params": [{
            "script": {
                "code_hash": xudt_code_hash,
                "hash_type": "type",
                "args": "0x"
            },
            "script_type": "type",
            "script_search_mode": "prefix"
        }, "asc", "0x64"]
    });

    let resp = client.post(indexer_url)
        .json(&request_body)
        .send()
        .await?;

    if !resp.status().is_success() {
        tracing::warn!("CKB indexer returned {}", resp.status());
        return Ok(());
    }

    let body: serde_json::Value = resp.json().await?;
    let cells = body["result"]["objects"].as_array().cloned().unwrap_or_default();

    tracing::info!("Found {} xUDT cells from indexer", cells.len());
    // Token registration handled by updater.rs via Explorer API
    Ok(())
}
