use common::context::PaymentContext;
use sea_orm::{EntityTrait, ColumnTrait, QueryFilter, ActiveModelTrait, Set};

/// Maximum age before marking a transaction as stuck (15 minutes)
const STUCK_TIMEOUT_SECS: i64 = 15 * 60;

/// Background task: monitor pending transactions for confirmation (HIGH-08 fix)
pub async fn start(ctx: PaymentContext) {
    tracing::info!("Transaction monitor started");
    loop {
        if let Err(e) = check_pending(&ctx).await {
            tracing::error!("Monitor error: {}", e);
        }
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    }
}

/// Check pending transactions for on-chain confirmation (HIGH-08 fix: actual implementation)
async fn check_pending(ctx: &PaymentContext) -> anyhow::Result<()> {
    // Step 1: Query payment_relayer_tx with status = "Submitted"
    let pending_txs = daos::payment_relayer_tx::Entity::find()
        .filter(daos::payment_relayer_tx::Column::Status.eq("Submitted"))
        .all(ctx.db())
        .await?;

    if pending_txs.is_empty() {
        return Ok(());
    }

    tracing::info!("Monitoring {} pending transactions", pending_txs.len());
    let client = reqwest::Client::new();
    let now = chrono::Utc::now().naive_utc();

    for tx in pending_txs {
        // tx_hash is Option<Vec<u8>> — convert to hex string
        let tx_hash_hex = match &tx.tx_hash {
            Some(bytes) => format!("0x{}", hex::encode(bytes)),
            None => {
                tracing::warn!("Transaction id={} has no tx_hash, skipping", tx.id);
                continue;
            }
        };

        // Determine which RPC URL to use based on chain_id (u64)
        let rpc_url = match tx.chain_id {
            42161 => &ctx.config.arbitrum_rpc_url,
            137 => &ctx.config.polygon_rpc_url,
            56 => &ctx.config.bsc_rpc_url,
            1 => &ctx.config.ethereum_rpc_url,
            other => {
                tracing::warn!("Unknown chain_id {} for tx {}, skipping", other, tx_hash_hex);
                continue;
            }
        };

        if rpc_url.is_empty() {
            tracing::warn!("RPC URL not configured for chain {}, skipping tx {}", tx.chain_id, tx_hash_hex);
            continue;
        }

        // Step 2: Call eth_getTransactionReceipt
        let receipt_result = get_transaction_receipt(&client, rpc_url, &tx_hash_hex).await;

        match receipt_result {
            Ok(Some(receipt)) => {
                // Step 3: Check receipt status (0x1 = success, 0x0 = reverted)
                let status_val = receipt.get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("0x0");

                let mut active: daos::payment_relayer_tx::ActiveModel = tx.into();

                if status_val == "0x1" {
                    active.status = Set("Confirmed".to_string());
                    active.update(ctx.db()).await?;
                    tracing::info!("Transaction {} confirmed on-chain", tx_hash_hex);
                } else {
                    active.status = Set("Failed".to_string());
                    active.update(ctx.db()).await?;
                    tracing::warn!("Transaction {} reverted on-chain", tx_hash_hex);
                }
            }
            Ok(None) => {
                // Receipt not available yet — check for timeout
                let created = tx.created_at;
                let age_secs = (now - created).num_seconds();

                if age_secs > STUCK_TIMEOUT_SECS {
                    let mut active: daos::payment_relayer_tx::ActiveModel = tx.into();
                    active.status = Set("Stuck".to_string());
                    active.update(ctx.db()).await?;
                    tracing::warn!("Transaction {} marked as Stuck (age={}s > {}s)", tx_hash_hex, age_secs, STUCK_TIMEOUT_SECS);
                }
            }
            Err(e) => {
                tracing::error!("Failed to query receipt for tx {}: {}", tx_hash_hex, e);
            }
        }
    }

    Ok(())
}

/// Query eth_getTransactionReceipt from an EVM RPC endpoint
async fn get_transaction_receipt(
    client: &reqwest::Client,
    rpc_url: &str,
    tx_hash: &str,
) -> anyhow::Result<Option<serde_json::Value>> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_getTransactionReceipt",
        "params": [tx_hash]
    });

    let resp = client.post(rpc_url).json(&body).send().await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().await.unwrap_or_default();
        anyhow::bail!("RPC HTTP error ({}): {}", status, err_body);
    }

    let json: serde_json::Value = resp.json().await?;

    // Check for RPC error
    if let Some(error) = json.get("error") {
        let message = error.get("message").and_then(|m| m.as_str()).unwrap_or("unknown");
        anyhow::bail!("RPC error: {}", message);
    }

    // result is null if transaction is still pending
    match json.get("result") {
        Some(serde_json::Value::Null) | None => Ok(None),
        Some(receipt) => Ok(Some(receipt.clone())),
    }
}
