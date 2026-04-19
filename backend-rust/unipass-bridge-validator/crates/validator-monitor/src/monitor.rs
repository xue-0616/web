use api::ValidatorContext;
use sha3::{Digest, Keccak256};

/// Chain configuration for bridge event monitoring
pub struct ChainConfig {
    pub chain_id: u64,
    pub rpc_url: String,
    pub bridge_contract: String,
    pub deposit_topic: String,
    pub last_block: u64,
}

/// Build chain configs from ValidatorContext. Loads last_synced_block from Redis first, then DB.
pub async fn build_chain_configs(ctx: &ValidatorContext) -> anyhow::Result<Vec<ChainConfig>> {
    let config = &ctx.config;
    let mut chains = Vec::new();

    // BridgeEvent topic0
    let topic0 = {
        let hash = Keccak256::digest(
            b"BridgeEvent(uint64,address,address,address,uint256)",
        );
        format!("0x{}", hex::encode(hash))
    };

    // Load last_synced_block from DB for each chain
    use sea_orm::EntityTrait;
    let chain_infos: Vec<validator_daos::chain_info::Model> =
        validator_daos::chain_info::Entity::find()
            .all(ctx.db())
            .await
            .unwrap_or_default();

    for chain_id in config.supported_chain_ids() {
        if let Some(rpc_url) = config.rpc_url_for_chain(chain_id) {
            // MEDIUM-15: Try Redis first for last_synced_block (faster recovery after restart)
            let redis_block = get_last_synced_block(ctx, chain_id).await;

            let db_block = chain_infos
                .iter()
                .find(|ci| ci.chain_id == chain_id)
                .map(|ci| ci.last_synced_block)
                .unwrap_or(0);

            // Use the higher value between Redis and DB (most recent sync point)
            let last_block = std::cmp::max(redis_block, db_block);

            let bridge_contract = chain_infos
                .iter()
                .find(|ci| ci.chain_id == chain_id)
                .map(|ci| format!("0x{}", hex::encode(&ci.bridge_contract)))
                .unwrap_or_default();

            if bridge_contract.is_empty() {
                tracing::warn!("No bridge contract configured for chain {}, skipping", chain_id);
                continue;
            }

            chains.push(ChainConfig {
                chain_id,
                rpc_url: rpc_url.to_string(),
                bridge_contract,
                deposit_topic: topic0.clone(),
                last_block,
            });
        }
    }

    Ok(chains)
}

/// Poll bridge contract events from each chain.
/// Verifies block finality, decodes logs, and processes events through the validation pipeline.
/// Updates last_synced_block in DB after each successful batch.
pub async fn poll_events(ctx: &ValidatorContext, chains: &[ChainConfig]) -> anyhow::Result<()> {
    let client = reqwest::Client::new();

    for chain in chains {
        // Get current block number
        let current_block = fetch_block_number(&client, &chain.rpc_url).await?;
        let required_confirmations = ctx.config.confirmations_for_chain(chain.chain_id);

        // Only process blocks that have sufficient confirmations
        let safe_block = current_block.saturating_sub(required_confirmations);
        if safe_block <= chain.last_block {
            tracing::debug!(
                "Chain {}: waiting for confirmations (current={}, safe={}, last_synced={})",
                chain.chain_id,
                current_block,
                safe_block,
                chain.last_block
            );
            continue;
        }

        // Process in chunks to avoid RPC limits
        let chunks = crate::utils::block_range_chunks(chain.last_block + 1, safe_block, 1000);

        for (from_block, to_block) in &chunks {
            let filter = serde_json::json!({
                "id": 1,
                "jsonrpc": "2.0",
                "method": "eth_getLogs",
                "params": [{
                    "fromBlock": format!("0x{:x}", from_block),
                    "toBlock": format!("0x{:x}", to_block),
                    "address": &chain.bridge_contract,
                    "topics": [&chain.deposit_topic]
                }]
            });

            let resp = client.post(&chain.rpc_url).json(&filter).send().await?;
            let body: serde_json::Value = resp.json().await?;

            if let Some(error) = body.get("error") {
                tracing::error!("RPC error for chain {}: {}", chain.chain_id, error);
                continue;
            }

            let logs = body["result"].as_array().cloned().unwrap_or_default();
            tracing::info!(
                "Chain {}: {} bridge events in blocks {}..{}",
                chain.chain_id,
                logs.len(),
                from_block,
                to_block
            );

            for log in &logs {
                if let Err(e) = process_bridge_log(ctx, chain, log).await {
                    tracing::error!(
                        "Failed to process bridge log on chain {}: {}",
                        chain.chain_id,
                        e
                    );
                    // Continue processing other logs — fail open on individual log errors
                    // but each individual validation still fails closed
                }
            }

            // Update last_synced_block in DB after each chunk
            update_last_synced_block(ctx, chain.chain_id, *to_block).await?;
        }
    }

    Ok(())
}

/// Process a single bridge event log from the chain.
async fn process_bridge_log(
    ctx: &ValidatorContext,
    chain: &ChainConfig,
    log: &serde_json::Value,
) -> anyhow::Result<()> {
    let topics = log["topics"]
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("Missing topics in log"))?;

    if topics.len() < 3 {
        anyhow::bail!("BridgeEvent must have at least 3 topics");
    }

    // Parse indexed parameters from topics
    let dest_chain_hex = topics[1].as_str().unwrap_or("0x0");
    let dest_chain_id = u64::from_str_radix(
        dest_chain_hex.trim_start_matches("0x"),
        16,
    )?;

    let sender_topic = topics[2].as_str().unwrap_or("");
    let sender_hex = sender_topic.trim_start_matches("0x");
    let sender = if sender_hex.len() >= 40 {
        format!("0x{}", &sender_hex[sender_hex.len() - 40..])
    } else {
        return Err(anyhow::anyhow!("Invalid sender topic"));
    };

    // Parse log data: abi.encode(recipient, token, amount)
    let data_hex = log["data"].as_str().unwrap_or("0x");
    let data = hex::decode(data_hex.trim_start_matches("0x"))?;
    if data.len() < 96 {
        anyhow::bail!("Log data too short for BridgeEvent");
    }

    let recipient = format!("0x{}", hex::encode(&data[12..32]));
    let token = format!("0x{}", hex::encode(&data[44..64]));
    let amount_bytes = &data[64..96];
    let amount = ethers::types::U256::from_big_endian(amount_bytes);

    let tx_hash = log["transactionHash"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let log_index_hex = log["logIndex"]
        .as_str()
        .unwrap_or("0x0");
    let log_index = u32::from_str_radix(
        log_index_hex.trim_start_matches("0x"),
        16,
    )
    .unwrap_or(0);

    tracing::info!(
        "Processing BridgeEvent: chain={}→{}, tx={}, sender={}, recipient={}, token={}, amount={}",
        chain.chain_id,
        dest_chain_id,
        tx_hash,
        sender,
        recipient,
        token,
        amount
    );

    // Run through validation pipeline
    let req = validator_handler::ValidationRequest {
        source_chain_id: chain.chain_id,
        dest_chain_id,
        tx_hash: tx_hash.clone(),
        log_index: Some(log_index),
        amount: amount.to_string(),
        token_address: token,
        sender,
        recipient,
    };

    match validator_handler::validate_payment(ctx, &req).await {
        Ok(result) => {
            if result.valid {
                tracing::info!("Bridge event validated: tx={}", tx_hash);
            } else {
                tracing::warn!(
                    "Bridge event rejected: tx={}, reason={:?}",
                    tx_hash,
                    result.rejection_reason
                );
            }
        }
        Err(e) => {
            tracing::error!("Validation error for tx={}: {}", tx_hash, e);
        }
    }

    Ok(())
}

/// Update last_synced_block in both DB and Redis (MEDIUM-15).
async fn update_last_synced_block(
    ctx: &ValidatorContext,
    chain_id: u64,
    block: u64,
) -> anyhow::Result<()> {
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, ActiveModelTrait, Set};

    // Update DB
    let existing = validator_daos::chain_info::Entity::find()
        .filter(validator_daos::chain_info::Column::ChainId.eq(chain_id))
        .one(ctx.db())
        .await?;

    if let Some(model) = existing {
        let mut active: validator_daos::chain_info::ActiveModel = model.into();
        active.last_synced_block = Set(block);
        active.update(ctx.db()).await?;
    }

    // Update Redis (MEDIUM-15: persist for fast recovery)
    set_last_synced_block(ctx, chain_id, block).await;

    tracing::debug!("Chain {}: last_synced_block updated to {} (DB + Redis)", chain_id, block);
    Ok(())
}

// --- MEDIUM-15: Redis-backed last synced block persistence ---

/// Get last synced block from Redis. Returns 0 if not found or on error.
/// Key format: `BRIDGE:LAST_SYNCED:{chain_id}`
pub async fn get_last_synced_block(ctx: &ValidatorContext, chain_id: u64) -> u64 {
    let key = format!("BRIDGE:LAST_SYNCED:{}", chain_id);
    match ctx.redis_conn().await {
        Ok(mut conn) => {
            let result: Result<String, _> = redis::cmd("GET")
                .arg(&key)
                .query_async(&mut *conn)
                .await;
            match result {
                Ok(val) => val.parse::<u64>().unwrap_or(0),
                Err(_) => 0,
            }
        }
        Err(e) => {
            tracing::warn!(
                "Redis error reading BRIDGE:LAST_SYNCED:{}: {}",
                chain_id, e
            );
            0
        }
    }
}

/// Set last synced block in Redis after each successful sync.
/// Key format: `BRIDGE:LAST_SYNCED:{chain_id}`
pub async fn set_last_synced_block(ctx: &ValidatorContext, chain_id: u64, block: u64) {
    let key = format!("BRIDGE:LAST_SYNCED:{}", chain_id);
    match ctx.redis_conn().await {
        Ok(mut conn) => {
            let result: Result<(), _> = redis::cmd("SET")
                .arg(&key)
                .arg(block.to_string())
                .query_async(&mut *conn)
                .await;
            if let Err(e) = result {
                tracing::warn!(
                    "Redis error writing BRIDGE:LAST_SYNCED:{}: {}",
                    chain_id, e
                );
            }
        }
        Err(e) => {
            tracing::warn!(
                "Redis connection error writing BRIDGE:LAST_SYNCED:{}: {}",
                chain_id, e
            );
        }
    }
}

/// Fetch current block number from an RPC endpoint.
async fn fetch_block_number(client: &reqwest::Client, rpc_url: &str) -> anyhow::Result<u64> {
    let body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "eth_blockNumber",
        "params": []
    });
    let resp = client.post(rpc_url).json(&body).send().await?;
    let json: serde_json::Value = resp.json().await?;
    let block_hex = json["result"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Missing block number in RPC response"))?;
    Ok(u64::from_str_radix(
        block_hex.trim_start_matches("0x"),
        16,
    )?)
}
