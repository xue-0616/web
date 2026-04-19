use crate::types::{ValidationError, ValidationRequest, ValidationResult};
use crate::utils;
use api::ValidatorContext;
use sha3::{Digest, Keccak256};

/// BridgeEvent(uint64 indexed destChainId, address indexed sender, address recipient, address token, uint256 amount)
/// topic0 = keccak256 of the event signature
fn bridge_event_topic0() -> String {
    let hash = Keccak256::digest(
        b"BridgeEvent(uint64,address,address,address,uint256)",
    );
    format!("0x{}", hex::encode(hash))
}

/// Full validation pipeline — FAIL CLOSED on any error.
///
/// Steps:
/// 1. Input validation (format, whitelist, limits)
/// 2. Replay check (has this tx_hash + log_index been processed?)
/// 3. Fetch source chain transaction receipt via RPC
/// 4. Verify block confirmations (chain-specific finality)
/// 5. Verify on-chain log data matches claimed parameters
/// 6. Sign the validated message with EIP-712
/// 7. Record as processed (replay protection)
pub async fn validate_payment(
    ctx: &ValidatorContext,
    req: &ValidationRequest,
) -> Result<ValidationResult, ValidationError> {
    let config = &ctx.config;

    // --- Step 1: Input validation ---
    tracing::info!(
        "Validating bridge payment: {}→{}, tx={}",
        req.source_chain_id, req.dest_chain_id, req.tx_hash
    );

    if !utils::is_valid_tx_hash(&req.tx_hash) {
        return Err(ValidationError::InvalidInput(
            "Invalid tx_hash format (must be 0x + 64 hex chars)".into(),
        ));
    }
    if !utils::is_valid_address(&req.token_address) {
        return Err(ValidationError::InvalidInput(
            "Invalid token_address format".into(),
        ));
    }
    if !utils::is_valid_address(&req.recipient) {
        return Err(ValidationError::InvalidInput(
            "Invalid recipient address format".into(),
        ));
    }
    if !utils::is_valid_address(&req.sender) {
        return Err(ValidationError::InvalidInput(
            "Invalid sender address format".into(),
        ));
    }

    // Validate amount is positive and parseable
    let amount_str = req.amount.trim();
    if amount_str.is_empty() || amount_str == "0" {
        return Err(ValidationError::InvalidInput(
            "Amount must be a positive integer".into(),
        ));
    }
    // Verify it's a valid decimal number (u256 range)
    if !amount_str.chars().all(|c| c.is_ascii_digit()) || amount_str.starts_with('0') && amount_str.len() > 1 {
        return Err(ValidationError::InvalidInput(
            "Amount must be a positive decimal integer without leading zeros".into(),
        ));
    }
    // Check max length for uint256 (78 digits max)
    if amount_str.len() > 78 {
        return Err(ValidationError::AmountExceedsLimit);
    }

    // Validate chain IDs against supported list
    let supported = config.supported_chain_ids();
    if !supported.contains(&req.source_chain_id) {
        return Err(ValidationError::UnsupportedChain(req.source_chain_id));
    }
    if !supported.contains(&req.dest_chain_id) {
        return Err(ValidationError::UnsupportedChain(req.dest_chain_id));
    }
    if req.source_chain_id == req.dest_chain_id {
        return Err(ValidationError::InvalidInput(
            "Source and destination chain must differ".into(),
        ));
    }

    // Validate token whitelist (if configured)
    let whitelist = config.token_whitelist_set();
    if !whitelist.is_empty() {
        let token_lower = req.token_address.to_lowercase();
        if !whitelist.contains(&token_lower) {
            return Err(ValidationError::UnwhitelistedToken(req.token_address.clone()));
        }
    }

    // Check max transfer amount (if configured)
    if !config.max_transfer_amount.is_empty() {
        let max_len = config.max_transfer_amount.len();
        let amt_len = amount_str.len();
        if amt_len > max_len || (amt_len == max_len && amount_str > config.max_transfer_amount.as_str()) {
            return Err(ValidationError::AmountExceedsLimit);
        }
    }

    // --- Step 2: Replay protection ---
    let log_index = req.log_index.unwrap_or(0);
    if check_replay(ctx, req.source_chain_id, &req.tx_hash, log_index).await? {
        return Err(ValidationError::ReplayDetected);
    }

    // --- Step 3: Fetch transaction receipt from source chain RPC ---
    let rpc_url = config
        .rpc_url_for_chain(req.source_chain_id)
        .ok_or_else(|| ValidationError::UnsupportedChain(req.source_chain_id))?;

    let receipt = fetch_tx_receipt(rpc_url, &req.tx_hash).await?;

    // Verify transaction was successful (status = 1)
    let status = receipt["status"]
        .as_str()
        .unwrap_or("0x0");
    if status != "0x1" {
        return Err(ValidationError::TxNotConfirmed);
    }

    // --- Step 4: Verify block confirmations ---
    let tx_block_hex = receipt["blockNumber"]
        .as_str()
        .ok_or_else(|| ValidationError::TxNotConfirmed)?;
    let tx_block = u64::from_str_radix(tx_block_hex.trim_start_matches("0x"), 16)
        .map_err(|_| ValidationError::TxNotConfirmed)?;

    let current_block = fetch_block_number(rpc_url).await?;
    let required_confirmations = config.confirmations_for_chain(req.source_chain_id);
    let confirmations = current_block.saturating_sub(tx_block);
    if confirmations < required_confirmations {
        return Err(ValidationError::InsufficientConfirmations {
            have: confirmations,
            need: required_confirmations,
        });
    }

    // --- Step 5: Verify on-chain log data ---
    let logs = receipt["logs"]
        .as_array()
        .ok_or_else(|| {
            ValidationError::LogVerificationFailed("No logs in receipt".into())
        })?;

    let expected_topic0 = bridge_event_topic0();
    let matching_log = if log_index < logs.len() as u32 {
        let log = &logs[log_index as usize];
        let topics = log["topics"].as_array();
        if let Some(topics) = topics {
            if !topics.is_empty() && topics[0].as_str() == Some(expected_topic0.as_str()) {
                Some(log)
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let log = matching_log.ok_or_else(|| {
        ValidationError::LogVerificationFailed(format!(
            "No BridgeEvent log found at index {}",
            log_index
        ))
    })?;

    // Verify log address matches expected bridge contract from chain_info DB
    {
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
        let chain_info = validator_daos::chain_info::Entity::find()
            .filter(validator_daos::chain_info::Column::ChainId.eq(req.source_chain_id))
            .one(ctx.db())
            .await
            .map_err(|e| ValidationError::Internal(format!("DB error looking up chain_info: {}", e)))?;

        if let Some(info) = chain_info {
            if !info.bridge_contract.is_empty() {
                let expected_addr = format!("0x{}", hex::encode(&info.bridge_contract)).to_lowercase();
                let log_addr = log["address"]
                    .as_str()
                    .unwrap_or("")
                    .to_lowercase();
                if log_addr != expected_addr {
                    return Err(ValidationError::LogVerificationFailed(format!(
                        "Log emitted by {} but expected bridge contract {}",
                        log_addr, expected_addr
                    )));
                }
            } else {
                return Err(ValidationError::LogVerificationFailed(format!(
                    "Bridge contract not configured in chain_info for chain {}",
                    req.source_chain_id
                )));
            }
        } else {
            return Err(ValidationError::LogVerificationFailed(format!(
                "No chain_info row found for chain {}; cannot verify bridge contract address",
                req.source_chain_id
            )));
        }
    }

    // Verify log topics: topic[1] = destChainId (indexed), topic[2] = sender (indexed)
    let topics = log["topics"].as_array().ok_or_else(|| {
        ValidationError::LogVerificationFailed("Missing topics".into())
    })?;
    if topics.len() < 3 {
        return Err(ValidationError::LogVerificationFailed(
            "BridgeEvent must have at least 3 topics".into(),
        ));
    }

    // topic[1] = destChainId as uint64 (left-padded to 32 bytes)
    let dest_chain_topic = topics[1]
        .as_str()
        .unwrap_or("");
    let dest_chain_from_log = parse_uint64_from_hex(dest_chain_topic)?;
    if dest_chain_from_log != req.dest_chain_id {
        return Err(ValidationError::LogVerificationFailed(format!(
            "destChainId mismatch: log={}, claimed={}",
            dest_chain_from_log, req.dest_chain_id
        )));
    }

    // topic[2] = sender (indexed address, left-padded to 32 bytes)
    let sender_topic = topics[2]
        .as_str()
        .unwrap_or("");
    let sender_from_log = parse_address_from_topic(sender_topic)?;
    let claimed_sender = req.sender.to_lowercase();
    if sender_from_log != claimed_sender {
        return Err(ValidationError::LogVerificationFailed(format!(
            "sender mismatch: log={}, claimed={}",
            sender_from_log, claimed_sender
        )));
    }

    // Decode log data: abi.encode(recipient, token, amount) — 3 x 32 bytes
    let log_data = log["data"]
        .as_str()
        .unwrap_or("0x");
    let data_bytes = hex::decode(log_data.trim_start_matches("0x"))
        .map_err(|_| ValidationError::LogVerificationFailed("Invalid log data hex".into()))?;
    if data_bytes.len() < 96 {
        return Err(ValidationError::LogVerificationFailed(
            "Log data too short (need 96 bytes for recipient+token+amount)".into(),
        ));
    }

    // recipient: bytes 12..32 of first word
    let recipient_from_log = format!("0x{}", hex::encode(&data_bytes[12..32]));
    let claimed_recipient = req.recipient.to_lowercase();
    if recipient_from_log != claimed_recipient {
        return Err(ValidationError::LogVerificationFailed(format!(
            "recipient mismatch: log={}, claimed={}",
            recipient_from_log, claimed_recipient
        )));
    }

    // token: bytes 44..64 of second word
    let token_from_log = format!("0x{}", hex::encode(&data_bytes[44..64]));
    let claimed_token = req.token_address.to_lowercase();
    if token_from_log != claimed_token {
        return Err(ValidationError::LogVerificationFailed(format!(
            "token mismatch: log={}, claimed={}",
            token_from_log, claimed_token
        )));
    }

    // amount: bytes 64..96 (uint256, big-endian)
    let amount_from_log = &data_bytes[64..96];
    let claimed_amount_u256 = decimal_to_u256_bytes(amount_str)?;
    if amount_from_log != claimed_amount_u256.as_slice() {
        return Err(ValidationError::LogVerificationFailed(format!(
            "amount mismatch: log=0x{}, claimed={}",
            hex::encode(amount_from_log),
            amount_str
        )));
    }

    // --- Step 6: Sign the validated message with EIP-712 ---
    let sender_bytes = parse_address_bytes(&req.sender)?;
    let recipient_bytes = parse_address_bytes(&req.recipient)?;
    let token_bytes = parse_address_bytes(&req.token_address)?;
    let mut nonce_bytes = [0u8; 32]; // nonce from source_chain_id + reserved + block + log_index
    nonce_bytes[0..8].copy_from_slice(&req.source_chain_id.to_be_bytes());
    nonce_bytes[8..16].copy_from_slice(&(0u64).to_be_bytes()); // reserved
    nonce_bytes[16..24].copy_from_slice(&tx_block.to_be_bytes());
    nonce_bytes[24..28].copy_from_slice(&log_index.to_be_bytes());

    // Use dest_chain_id for domain separator (signatures are verified on dest chain).
    // Load bridge contract address from chain_info DB for the destination chain.
    //
    // Security note: the EIP-712 domain separator binds the signature to a specific
    // verifyingContract. If we sign against a zero address here, the resulting
    // signature is useless on-chain (it will not be accepted by the real bridge)
    // and we also risk issuing a signature that matches a weaker verifier that
    // happens to accept the zero domain. Fail-closed if the DB does not give us
    // a well-formed 20-byte contract address.
    let bridge_contract: [u8; 20] = {
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
        let dest_info = validator_daos::chain_info::Entity::find()
            .filter(validator_daos::chain_info::Column::ChainId.eq(req.dest_chain_id))
            .one(ctx.db())
            .await
            .map_err(|e| ValidationError::Internal(format!("DB error looking up dest chain_info: {}", e)))?;

        let info = dest_info.ok_or_else(|| {
            ValidationError::LogVerificationFailed(format!(
                "No chain_info row for dest chain {}; refusing to sign against zero domain",
                req.dest_chain_id
            ))
        })?;

        if info.bridge_contract.len() != 20 {
            return Err(ValidationError::LogVerificationFailed(format!(
                "Dest chain {} bridge_contract has invalid length {} (expected 20); refusing to sign",
                req.dest_chain_id,
                info.bridge_contract.len()
            )));
        }

        let mut addr = [0u8; 20];
        addr.copy_from_slice(&info.bridge_contract);
        if addr == [0u8; 20] {
            return Err(ValidationError::LogVerificationFailed(format!(
                "Dest chain {} bridge_contract stored as zero address; refusing to sign",
                req.dest_chain_id
            )));
        }
        addr
    };

    // Compute the EIP-712 digest (msg_hash) explicitly so we can use it for multisig tracking
    let domain_sep = validator_signer::ValidatorSigner::domain_separator(
        req.dest_chain_id,
        &bridge_contract,
    );
    let struct_hash = validator_signer::ValidatorSigner::bridge_message_hash(
        req.source_chain_id,
        req.dest_chain_id,
        &sender_bytes,
        &recipient_bytes,
        &token_bytes,
        &claimed_amount_u256,
        &nonce_bytes,
    );
    let msg_hash = validator_signer::ValidatorSigner::eip712_digest(&domain_sep, &struct_hash);

    // Sign the digest
    let signature = ctx
        .signer
        .sign_hash(&msg_hash)
        .map_err(|e| ValidationError::Internal(format!("Signing failed: {}", e)))?;

    let sig_hex = format!("0x{}", hex::encode(&signature));
    let msg_hash_hex = format!("0x{}", hex::encode(&msg_hash));
    tracing::info!(
        "Bridge payment validated and signed: tx={}, msg_hash={}, sig_len={}",
        req.tx_hash,
        msg_hash_hex,
        signature.len()
    );

    // --- Step 6b: Multisig signature collection ---
    let threshold = config.threshold;
    let validator_addr = format!("{:?}", ctx.signer.address()).to_lowercase();

    let multisig_result = collect_multisig_signature(
        ctx,
        &msg_hash_hex,
        &validator_addr,
        &sig_hex,
        threshold,
    )
    .await?;

    // --- Step 7: Record as processed (replay protection) ---
    record_processed(ctx, req.source_chain_id, &req.tx_hash, log_index).await?;

    if multisig_result.threshold_met {
        Ok(ValidationResult::threshold_met(
            sig_hex,
            multisig_result.all_signatures,
            msg_hash_hex,
            multisig_result.count,
            threshold,
        ))
    } else {
        Ok(ValidationResult::pending_multisig(
            sig_hex,
            msg_hash_hex,
            multisig_result.count,
            threshold,
        ))
    }
}

// --- Multisig helper ---

/// Result of multisig signature collection.
pub struct MultisigCollectionResult {
    pub threshold_met: bool,
    pub count: u32,
    pub all_signatures: Vec<String>,
}

/// Store a validator signature in Redis and check if the multisig threshold is met.
///
/// Uses a single Lua script to atomically check validator-set membership + HSET + EXPIRE
/// + HLEN + conditional HVALS, preventing race conditions and unauthorized writes.
///
/// Redis key: `BRIDGE:SIGS:{msg_hash}` (hash type)
///   - field = validator_address (lowercase hex)
///   - value = signature_hex
/// TTL: 1 hour (signatures expire if threshold is not met in time)
///
/// **BUG-B1 FIX**: The Lua script now checks that the validator_address is a member of the
/// configured validator_set before performing HSET. This provides defense-in-depth even if
/// application-level checks are bypassed.
pub async fn collect_multisig_signature(
    ctx: &ValidatorContext,
    msg_hash_hex: &str,
    validator_address: &str,
    signature_hex: &str,
    threshold: u32,
) -> Result<MultisigCollectionResult, ValidationError> {
    let redis_key = format!("BRIDGE:SIGS:{}", msg_hash_hex.to_lowercase());

    let mut conn = ctx
        .redis_conn()
        .await
        .map_err(|e| ValidationError::Internal(format!("Redis error: {}", e)))?;

    // Build the validator set as a comma-separated string for the Lua script.
    let validator_set = ctx.config.validator_set_addresses();
    let validator_set_csv = validator_set.join(",");

    // Atomic Lua script: check validator membership → HSET → EXPIRE → HLEN → conditional HVALS.
    // Returns:
    //   -1              if validator_address is NOT in the allowed set (rejected)
    //   integer count   if threshold not yet met
    //   bulk array      of all signature values if threshold is met
    let lua_script = r#"
        -- ARGV[1] = validator_address (lowercase hex)
        -- ARGV[2] = signature_hex
        -- ARGV[3] = TTL seconds
        -- ARGV[4] = threshold
        -- ARGV[5] = comma-separated validator set (lowercase hex addresses)

        -- BUG-B1 FIX: Check validator-set membership before HSET
        local allowed = false
        for addr in string.gmatch(ARGV[5], "[^,]+") do
            if addr == ARGV[1] then
                allowed = true
                break
            end
        end
        if not allowed then
            return -1
        end

        redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
        redis.call("EXPIRE", KEYS[1], ARGV[3])
        local count = redis.call("HLEN", KEYS[1])
        if tonumber(count) >= tonumber(ARGV[4]) then
            return redis.call("HVALS", KEYS[1])
        else
            return count
        end
    "#;

    // Execute the Lua script. The return type depends on the outcome:
    // - If rejected (not in validator set): returns integer -1
    // - If threshold not met: returns an integer count
    // - If threshold met: returns a bulk array of signature strings
    let result: redis::Value = redis::cmd("EVAL")
        .arg(lua_script)
        .arg(1i64)              // number of KEYS
        .arg(&redis_key)        // KEYS[1]
        .arg(validator_address) // ARGV[1]
        .arg(signature_hex)     // ARGV[2]
        .arg(3600_u64)          // ARGV[3] = TTL
        .arg(threshold)         // ARGV[4] = threshold
        .arg(&validator_set_csv) // ARGV[5] = validator set
        .query_async(&mut *conn)
        .await
        .map_err(|e| ValidationError::Internal(format!("Redis Lua script error: {}", e)))?;

    match result {
        redis::Value::Int(-1) => {
            // BUG-B1 FIX: Lua script rejected — validator_address not in allowed set
            tracing::warn!(
                "Redis Lua rejected signature from unauthorized validator: {} (not in validator set)",
                validator_address
            );
            Err(ValidationError::InvalidInput(format!(
                "Validator address {} is not in the authorized validator set",
                validator_address
            )))
        }
        redis::Value::Array(values) => {
            // Threshold met — values are all collected signatures
            let all_signatures: Vec<String> = values
                .into_iter()
                .filter_map(|v| match v {
                    redis::Value::BulkString(data) => String::from_utf8(data).ok(),
                    _ => None,
                })
                .collect();
            let count = all_signatures.len() as u32;
            tracing::info!(
                "Multisig threshold met for {}: {}/{} signatures collected",
                msg_hash_hex,
                count,
                threshold
            );
            Ok(MultisigCollectionResult {
                threshold_met: true,
                count,
                all_signatures,
            })
        }
        redis::Value::Int(count) => {
            // Threshold not yet met — count is the number of signatures so far
            tracing::info!(
                "Multisig pending for {}: {}/{} signatures collected",
                msg_hash_hex,
                count,
                threshold
            );
            Ok(MultisigCollectionResult {
                threshold_met: false,
                count: count as u32,
                all_signatures: Vec::new(),
            })
        }
        other => {
            Err(ValidationError::Internal(format!(
                "Unexpected Redis Lua script return type: {:?}",
                other
            )))
        }
    }
}

// --- Helper functions ---

/// Atomically check-and-set replay protection using Redis SET NX.
/// Returns true if this is a replay (already processed), false if first time.
///
/// Uses SET NX (set-if-not-exists) as an atomic operation to prevent the
/// TOCTOU race condition that would exist with separate EXISTS + SET calls.
/// Also checks DB as defense-in-depth for messages older than the Redis TTL.
async fn check_replay(
    ctx: &ValidatorContext,
    source_chain_id: u64,
    tx_hash: &str,
    log_index: u32,
) -> Result<bool, ValidationError> {
    let key = format!(
        "BRIDGE:PROCESSED:{}:{}:{}",
        source_chain_id,
        tx_hash.to_lowercase(),
        log_index
    );
    let mut conn = ctx
        .redis_conn()
        .await
        .map_err(|e| ValidationError::Internal(format!("Redis error: {}", e)))?;

    // Atomic SET NX with 30-day TTL:
    // Returns true (set succeeded) if key didn't exist → first time, not replay
    // Returns false (set failed) if key already existed → replay
    let set_result: bool = redis::cmd("SET")
        .arg(&key)
        .arg("1")
        .arg("NX")
        .arg("EX")
        .arg(86400_u64 * 30) // 30 days TTL
        .query_async(&mut *conn)
        .await
        .unwrap_or(false); // On Redis failure, fall through to DB check

    if !set_result {
        // Key already existed in Redis — this is a replay
        tracing::warn!(
            "Replay detected (Redis): {}:{}:{}",
            source_chain_id,
            tx_hash,
            log_index
        );
        return Ok(true);
    }

    // Redis said first-time, but also check DB as defense-in-depth
    // (covers messages older than Redis TTL or after Redis restart)
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
    let tx_hash_bytes = hex::decode(tx_hash.trim_start_matches("0x"))
        .map_err(|_| ValidationError::InvalidInput("Invalid tx_hash hex".into()))?;
    let existing = validator_daos::bridge_event::Entity::find()
        .filter(validator_daos::bridge_event::Column::ChainId.eq(source_chain_id))
        .filter(validator_daos::bridge_event::Column::TxHash.eq(tx_hash_bytes.clone()))
        .filter(validator_daos::bridge_event::Column::LogIndex.eq(log_index))
        .one(ctx.db())
        .await
        .map_err(|e| ValidationError::Internal(format!("DB error: {}", e)))?;

    if existing.is_some() {
        tracing::warn!(
            "Replay detected (DB): {}:{}:{}",
            source_chain_id,
            tx_hash,
            log_index
        );
        return Ok(true);
    }

    Ok(false)
}

/// Record a processed message for persistent replay protection.
/// Called AFTER successful validation and signing.
/// Redis was already set atomically in check_replay; this adds DB persistence.
async fn record_processed(
    ctx: &ValidatorContext,
    source_chain_id: u64,
    tx_hash: &str,
    log_index: u32,
) -> Result<(), ValidationError> {
    // Write to DB (defense-in-depth) — unique constraint on (chain_id, tx_hash, log_index)
    use sea_orm::{ActiveModelTrait, Set};
    let tx_hash_bytes = hex::decode(tx_hash.trim_start_matches("0x"))
        .map_err(|_| ValidationError::InvalidInput("Invalid tx_hash hex".into()))?;
    let event = validator_daos::bridge_event::ActiveModel {
        chain_id: Set(source_chain_id),
        tx_hash: Set(tx_hash_bytes),
        log_index: Set(log_index),
        block_number: Set(0), // Updated by caller if needed
        event_type: Set("BridgeEvent".to_string()),
        data: Set(String::new()),
        created_at: Set(chrono::Utc::now().naive_utc()),
        ..Default::default()
    };
    // Use insert — if unique constraint fails, it's a concurrent replay attempt
    if let Err(e) = event.insert(ctx.db()).await {
        tracing::warn!(
            "DB insert for replay protection failed (possible concurrent replay): {}",
            e
        );
        // Don't fail — Redis already has the record from check_replay
    }

    Ok(())
}

/// Fetch transaction receipt from RPC.
async fn fetch_tx_receipt(
    rpc_url: &str,
    tx_hash: &str,
) -> Result<serde_json::Value, ValidationError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "eth_getTransactionReceipt",
        "params": [tx_hash]
    });
    let resp = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| ValidationError::RpcError(format!("RPC request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(ValidationError::RpcError(format!(
            "RPC returned status {}",
            resp.status()
        )));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| ValidationError::RpcError(format!("Invalid RPC response: {}", e)))?;

    if let Some(error) = json.get("error") {
        return Err(ValidationError::RpcError(format!(
            "RPC error: {}",
            error
        )));
    }

    let result = json
        .get("result")
        .cloned()
        .ok_or_else(|| ValidationError::TxNotConfirmed)?;

    if result.is_null() {
        return Err(ValidationError::TxNotConfirmed);
    }

    Ok(result)
}

/// Fetch current block number from RPC.
async fn fetch_block_number(rpc_url: &str) -> Result<u64, ValidationError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "eth_blockNumber",
        "params": []
    });
    let resp = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| ValidationError::RpcError(format!("RPC request failed: {}", e)))?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| ValidationError::RpcError(format!("Invalid RPC response: {}", e)))?;

    let block_hex = json["result"]
        .as_str()
        .ok_or_else(|| ValidationError::RpcError("Missing block number".into()))?;

    u64::from_str_radix(block_hex.trim_start_matches("0x"), 16)
        .map_err(|_| ValidationError::RpcError("Invalid block number format".into()))
}

/// Parse a uint64 from a 0x-prefixed hex topic (32-byte left-padded).
fn parse_uint64_from_hex(hex_str: &str) -> Result<u64, ValidationError> {
    let clean = hex_str.trim_start_matches("0x");
    u64::from_str_radix(clean, 16)
        .map_err(|_| ValidationError::LogVerificationFailed(format!("Cannot parse uint64 from {}", hex_str)))
}

/// Parse an address from a 32-byte hex topic (left-padded). Returns lowercase 0x-prefixed.
fn parse_address_from_topic(hex_str: &str) -> Result<String, ValidationError> {
    let clean = hex_str.trim_start_matches("0x");
    if clean.len() < 40 {
        return Err(ValidationError::LogVerificationFailed(
            "Topic too short for address".into(),
        ));
    }
    // Address is the last 40 chars (20 bytes) of the 64-char topic
    let addr = &clean[clean.len() - 40..];
    Ok(format!("0x{}", addr.to_lowercase()))
}

/// Parse an address string into 20 bytes.
fn parse_address_bytes(addr: &str) -> Result<[u8; 20], ValidationError> {
    let clean = addr.trim_start_matches("0x");
    let bytes = hex::decode(clean)
        .map_err(|_| ValidationError::InvalidInput(format!("Invalid address hex: {}", addr)))?;
    if bytes.len() != 20 {
        return Err(ValidationError::InvalidInput(format!(
            "Address must be 20 bytes, got {}",
            bytes.len()
        )));
    }
    let mut out = [0u8; 20];
    out.copy_from_slice(&bytes);
    Ok(out)
}

/// Convert a decimal string to uint256 (32 bytes big-endian).
/// This is a simple implementation for bridge amounts.
fn decimal_to_u256_bytes(decimal_str: &str) -> Result<[u8; 32], ValidationError> {
    // Parse as ethers U256
    let val = ethers::types::U256::from_dec_str(decimal_str)
        .map_err(|_| ValidationError::InvalidInput(format!("Cannot parse amount: {}", decimal_str)))?;
    let mut bytes = [0u8; 32];
    val.to_big_endian(&mut bytes);
    Ok(bytes)
}
