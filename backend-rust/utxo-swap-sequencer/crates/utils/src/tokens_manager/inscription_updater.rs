use api_common::context::AppContext;

/// Scan for CKB Inscription protocol tokens (Spore/DOB)
pub async fn scan_inscriptions(ctx: &AppContext) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    let indexer_url = &ctx.config.ckb_indexer_url;

    // Spore DOB cluster type script code_hash
    let spore_code_hash = "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d";

    let request_body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "get_cells",
        "params": [{
            "script": {
                "code_hash": spore_code_hash,
                "hash_type": "data1",
                "args": "0x"
            },
            "script_type": "type",
            "script_search_mode": "prefix"
        }, "asc", "0x32"]
    });

    let resp = client.post(indexer_url)
        .json(&request_body)
        .send()
        .await?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await?;
        let count = body["result"]["objects"].as_array().map(|a| a.len()).unwrap_or(0);
        tracing::info!("Found {} inscription cells", count);
    }

    Ok(())
}
