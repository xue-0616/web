use api::ValidatorContext;
use crate::utils;
use ethers::types::{U256, TransactionRequest, Bytes};
use ethers::signers::Signer;

/// Batch payload for submission to the destination chain bridge contract.
#[derive(Debug, Clone)]
pub struct BatchPayload {
    pub batch_id: String,
    pub dest_chain_id: u64,
    pub bridge_contract: ethers::types::Address, // Destination chain bridge contract address
    pub data: Vec<u8>,       // ABI-encoded batch data
    pub signatures: Vec<Vec<u8>>, // Collected validator signatures
}

/// Submit validated + signed bridge transactions to dest chain.
///
/// Steps:
/// 1. Get gas price and apply safety limits
/// 2. Estimate gas via eth_estimateGas (with fallback to formula)
/// 3. Simulate transaction via eth_call
/// 4. Submit via eth_sendRawTransaction with retry
/// 5. Wait for confirmation
/// 6. Return tx hash on success
pub async fn submit_batch(
    ctx: &ValidatorContext,
    batch: &BatchPayload,
) -> anyhow::Result<String> {
    let config = &ctx.config;
    let rpc_url = config
        .rpc_url_for_chain(batch.dest_chain_id)
        .ok_or_else(|| anyhow::anyhow!("No RPC URL for chain {}", batch.dest_chain_id))?;

    let client = reqwest::Client::new();

    // Step 1: Get gas price with safety cap
    let gas_price = fetch_gas_price(&client, rpc_url).await?;
    let max_gas_wei = U256::from(config.max_gas_price_gwei) * U256::from(1_000_000_000u64);
    if gas_price > max_gas_wei {
        anyhow::bail!(
            "Gas price {} exceeds maximum {} gwei — aborting to protect funds",
            gas_price,
            config.max_gas_price_gwei
        );
    }
    // Apply multiplier (e.g., 120 = 1.2x)
    let adjusted_gas_price = gas_price * U256::from(config.gas_price_multiplier) / U256::from(100u64);
    let final_gas_price = std::cmp::min(adjusted_gas_price, max_gas_wei);

    // Step 2: Estimate gas
    let payment_count = batch.signatures.len();
    let estimated_gas = utils::estimate_batch_gas(payment_count, config.gas_price_multiplier);

    tracing::info!(
        "Submitting batch {} to chain {}: gas_price={}, gas_limit={}, signatures={}",
        batch.batch_id,
        batch.dest_chain_id,
        final_gas_price,
        estimated_gas,
        payment_count
    );

    // Step 3: Simulate via eth_call first
    let validator_address = ctx.signer.address();
    let call_data = encode_submit_batch_calldata(&batch.data, &batch.signatures);

    let simulate_body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [{
            "from": format!("0x{}", hex::encode(validator_address.as_bytes())),
            "to": format!("{:?}", batch.bridge_contract),
            "data": format!("0x{}", hex::encode(&call_data)),
            "gas": format!("0x{:x}", estimated_gas),
            "gasPrice": format!("0x{:x}", final_gas_price),
        }, "latest"]
    });
    let sim_resp = client.post(rpc_url).json(&simulate_body).send().await?;
    let sim_json: serde_json::Value = sim_resp.json().await?;
    if let Some(error) = sim_json.get("error") {
        anyhow::bail!("Transaction simulation failed: {} — NOT submitting", error);
    }

    // Step 4: Get nonce
    let nonce = fetch_nonce(&client, rpc_url, &validator_address).await?;

    // Step 5: Build, sign locally, and submit raw transaction with retry.
    //
    // **BUG-B4 FIX**: Use the SAME nonce for all retry attempts with an escalating gas price
    // (replacement transaction / "speed-up" pattern). Previously each retry incremented the
    // nonce, which could cause duplicate on-chain submissions if earlier transactions eventually
    // confirmed. Now retries replace the pending transaction in the mempool.
    let mut last_error = None;
    let mut last_tx_hash: Option<String> = None;

    for attempt in 0..3u32 {
        if attempt > 0 {
            tracing::info!("Retry attempt {} for batch {} (replacement tx, same nonce)", attempt, batch.batch_id);
            tokio::time::sleep(std::time::Duration::from_secs(2u64.pow(attempt))).await;

            // Before retrying, check if the previous tx was confirmed while we waited
            if let Some(ref prev_hash) = last_tx_hash {
                match wait_for_confirmation(&client, rpc_url, prev_hash, 0).await {
                    Ok(true) => {
                        tracing::info!(
                            "Batch {} confirmed during retry wait: tx_hash={}",
                            batch.batch_id,
                            prev_hash
                        );
                        return Ok(prev_hash.clone());
                    }
                    _ => {
                        // Not yet confirmed — proceed with replacement tx
                    }
                }
            }
        }

        // BUG-B4 FIX: Same nonce for all attempts; escalate gas price by 10% per retry
        // to ensure the replacement transaction is accepted by the mempool.
        let retry_gas_price = final_gas_price
            + (final_gas_price * U256::from(10u64) * U256::from(attempt as u64) / U256::from(100u64));
        // Cap at max gas price
        let capped_gas_price = std::cmp::min(retry_gas_price, max_gas_wei);

        // Build transaction request with the SAME nonce
        let tx_request = TransactionRequest::new()
            .to(batch.bridge_contract)
            .data(Bytes::from(call_data.clone()))
            .gas(estimated_gas)
            .gas_price(capped_gas_price)
            .nonce(nonce)
            .chain_id(batch.dest_chain_id);

        // Sign the transaction locally using the validator's wallet
        let typed_tx: ethers::types::transaction::eip2718::TypedTransaction = tx_request.into();
        let signature = ctx.signer.wallet()
            .sign_transaction(&typed_tx)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to sign transaction: {}", e))?;
        let raw_tx = typed_tx.rlp_signed(&signature);

        // Submit signed raw transaction via eth_sendRawTransaction
        let tx_body = serde_json::json!({
            "id": 1,
            "jsonrpc": "2.0",
            "method": "eth_sendRawTransaction",
            "params": [format!("0x{}", hex::encode(&raw_tx))]
        });

        let resp = client.post(rpc_url).json(&tx_body).send().await?;
        let json: serde_json::Value = resp.json().await?;

        if let Some(error) = json.get("error") {
            let err_str = format!("RPC error: {}", error);
            // If we get "nonce too low", it means a previous attempt was already mined
            let err_msg = error.to_string().to_lowercase();
            if err_msg.contains("nonce too low") || err_msg.contains("already known") {
                // Previous tx with this nonce was mined — check if it was ours
                if let Some(ref prev_hash) = last_tx_hash {
                    match wait_for_confirmation(&client, rpc_url, prev_hash, 15).await {
                        Ok(true) => {
                            tracing::info!(
                                "Batch {} confirmed (nonce consumed): tx_hash={}",
                                batch.batch_id,
                                prev_hash
                            );
                            return Ok(prev_hash.clone());
                        }
                        _ => {}
                    }
                }
            }
            last_error = Some(err_str);
            continue;
        }

        if let Some(tx_hash) = json["result"].as_str() {
            tracing::info!(
                "Batch {} submitted (attempt {}): tx_hash={}, gas_price={}",
                batch.batch_id,
                attempt,
                tx_hash,
                capped_gas_price
            );
            last_tx_hash = Some(tx_hash.to_string());

            // Step 6: Wait for confirmation
            let confirmed = wait_for_confirmation(&client, rpc_url, tx_hash, 60).await;
            match confirmed {
                Ok(true) => {
                    tracing::info!("Batch {} confirmed: tx_hash={}", batch.batch_id, tx_hash);
                    return Ok(tx_hash.to_string());
                }
                Ok(false) => {
                    last_error = Some("Transaction not confirmed within timeout".to_string());
                }
                Err(e) => {
                    last_error = Some(format!("Confirmation check error: {}", e));
                }
            }
        }
    }

    Err(anyhow::anyhow!(
        "Failed to submit batch {} after 3 attempts: {}",
        batch.batch_id,
        last_error.unwrap_or_else(|| "unknown error".to_string())
    ))
}

/// Encode the submitBatch(bytes,bytes[]) function call using proper ABI encoding.
///
/// ABI layout:
///   selector (4 bytes)
///   offset_data (32 bytes) → points to data bytes encoding
///   offset_sigs (32 bytes) → points to signatures array encoding
///   --- data bytes ---
///   length_data (32 bytes)
///   data_padded (ceil(len/32)*32 bytes)
///   --- signatures array ---
///   num_sigs (32 bytes)
///   offset_sig[0], offset_sig[1], ... (each 32 bytes, relative to array start)
///   for each sig:
///     length_sig_i (32 bytes)
///     sig_i_padded (ceil(len/32)*32 bytes)
fn encode_submit_batch_calldata(data: &[u8], signatures: &[Vec<u8>]) -> Vec<u8> {
    use sha3::{Digest, Keccak256};
    let selector = &Keccak256::digest(b"submitBatch(bytes,bytes[])")[..4];

    let mut calldata = Vec::new();
    calldata.extend_from_slice(selector);

    // We have two dynamic parameters: bytes and bytes[]
    // offset_data = 64 (2 * 32 = two offset words)
    let offset_data: usize = 64;

    // Compute size of encoded data bytes section
    let data_padded_len = pad32(data.len());
    let data_section_size = 32 + data_padded_len; // length word + padded data

    // offset_sigs = offset_data + data_section_size
    let offset_sigs: usize = offset_data + data_section_size;

    // Write offset_data as uint256
    calldata.extend_from_slice(&encode_uint256(offset_data as u64));
    // Write offset_sigs as uint256
    calldata.extend_from_slice(&encode_uint256(offset_sigs as u64));

    // --- Encode data bytes ---
    calldata.extend_from_slice(&encode_uint256(data.len() as u64));
    calldata.extend_from_slice(data);
    // Pad to 32-byte boundary
    let pad_needed = data_padded_len - data.len();
    calldata.extend(std::iter::repeat(0u8).take(pad_needed));

    // --- Encode bytes[] signatures array ---
    let num_sigs = signatures.len();
    // Array length
    calldata.extend_from_slice(&encode_uint256(num_sigs as u64));

    // Compute offsets for each signature relative to start of dynamic part (after offsets array)
    // Each signature's offset is relative to the start of the array's data section
    // The offsets array itself takes num_sigs * 32 bytes
    let offsets_section_size = num_sigs * 32;
    let mut current_offset = offsets_section_size;
    let mut sig_offsets = Vec::with_capacity(num_sigs);

    for sig in signatures {
        sig_offsets.push(current_offset);
        let sig_padded_len = pad32(sig.len());
        current_offset += 32 + sig_padded_len; // length word + padded sig
    }

    // Write offsets
    for off in &sig_offsets {
        calldata.extend_from_slice(&encode_uint256(*off as u64));
    }

    // Write each signature
    for sig in signatures {
        calldata.extend_from_slice(&encode_uint256(sig.len() as u64));
        calldata.extend_from_slice(sig);
        let sig_padded_len = pad32(sig.len());
        let sig_pad = sig_padded_len - sig.len();
        calldata.extend(std::iter::repeat(0u8).take(sig_pad));
    }

    calldata
}

/// Encode a u64 as a 32-byte big-endian uint256.
fn encode_uint256(val: u64) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[24..32].copy_from_slice(&val.to_be_bytes());
    buf
}

/// Round up to the nearest multiple of 32.
fn pad32(len: usize) -> usize {
    (len + 31) / 32 * 32
}

/// Fetch current gas price from RPC.
async fn fetch_gas_price(client: &reqwest::Client, rpc_url: &str) -> anyhow::Result<U256> {
    let body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "eth_gasPrice",
        "params": []
    });
    let resp = client.post(rpc_url).json(&body).send().await?;
    let json: serde_json::Value = resp.json().await?;
    let hex_str = json["result"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Missing gas price"))?;
    Ok(U256::from_str_radix(hex_str.trim_start_matches("0x"), 16)?)
}

/// Fetch transaction count (nonce) for an address.
async fn fetch_nonce(
    client: &reqwest::Client,
    rpc_url: &str,
    address: &ethers::types::Address,
) -> anyhow::Result<U256> {
    let body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "eth_getTransactionCount",
        "params": [format!("0x{}", hex::encode(address.as_bytes())), "pending"]
    });
    let resp = client.post(rpc_url).json(&body).send().await?;
    let json: serde_json::Value = resp.json().await?;
    let hex_str = json["result"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Missing nonce"))?;
    Ok(U256::from_str_radix(hex_str.trim_start_matches("0x"), 16)?)
}

/// Wait for a transaction to be confirmed.
async fn wait_for_confirmation(
    client: &reqwest::Client,
    rpc_url: &str,
    tx_hash: &str,
    timeout_secs: u64,
) -> anyhow::Result<bool> {
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);

    while tokio::time::Instant::now() < deadline {
        let body = serde_json::json!({
            "id": 1,
            "jsonrpc": "2.0",
            "method": "eth_getTransactionReceipt",
            "params": [tx_hash]
        });
        let resp = client.post(rpc_url).json(&body).send().await?;
        let json: serde_json::Value = resp.json().await?;

        if let Some(result) = json.get("result") {
            if !result.is_null() {
                let status = result["status"].as_str().unwrap_or("0x0");
                return Ok(status == "0x1");
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    }

    Ok(false)
}
