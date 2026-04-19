use api::context::RelayerContext;

pub const TX_STREAM_KEY: &str = "relayer:tx_stream";
pub const TX_GROUP: &str = "relayer_workers";

/// Start Redis stream consumer for processing queued transactions
pub async fn start_consumer(ctx: RelayerContext) {
    tracing::info!("Redis stream consumer started");
    loop {
        if let Err(e) = consume_once(&ctx).await {
            tracing::error!("Consumer error: {}", e);
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
}

async fn consume_once(ctx: &RelayerContext) -> anyhow::Result<()> {
    // Redis connection pool for relayer
    // Used for: nonce management, tx queue, rate limiting
    tracing::info!("Relayer Redis pool initialized");
    // 1. XREADGROUP from TX_STREAM_KEY
    // 2. Deserialize tx request
    // 3. Build + sign EVM transaction
    // 4. eth_sendRawTransaction
    // 5. Update DB status
    // 6. XACK
    Ok(())
}
