use actix_web::{web, HttpResponse};
use api::context::RelayerContext;
use ethers::core::types::{Address, Signature, H256};
use ethers::utils::keccak256;
use serde::Deserialize;
use std::str::FromStr;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendTxRequest {
    pub chain_id: u64,
    pub wallet_address: String,
    pub calldata: String,
    pub signature: String,
    pub fee_token: Option<String>,
    pub fee_amount: Option<String>,
}

/// SECURITY FIX (BUG-20): Perform actual ECDSA signature verification (ecrecover)
/// instead of only structural checks. Recovers the signer address from the signature
/// and verifies it matches the expected wallet address.
fn verify_transaction_signature(
    calldata: &str,
    signature: &str,
    expected_wallet: &str,
) -> Result<(), String> {
    // Validate inputs are valid hex
    let calldata_bytes = hex::decode(calldata.strip_prefix("0x").unwrap_or(calldata))
        .map_err(|_| "Invalid calldata hex".to_string())?;

    let sig_bytes = hex::decode(signature.strip_prefix("0x").unwrap_or(signature))
        .map_err(|_| "Invalid signature hex".to_string())?;

    // ECDSA signature must be 65 bytes (r: 32, s: 32, v: 1)
    if sig_bytes.len() != 65 {
        return Err(format!(
            "Signature must be 65 bytes, got {}",
            sig_bytes.len()
        ));
    }

    // Validate wallet address format (0x + 40 hex chars)
    let wallet_stripped = expected_wallet
        .strip_prefix("0x")
        .unwrap_or(expected_wallet);
    if wallet_stripped.len() != 40 || !wallet_stripped.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid wallet address format".to_string());
    }

    // Verify signature is non-zero (basic sanity)
    if sig_bytes.iter().all(|&b| b == 0) {
        return Err("Signature is all zeros".to_string());
    }

    // Verify calldata is non-empty
    if calldata_bytes.is_empty() {
        return Err("Calldata is empty".to_string());
    }

    // --- Full ECDSA ecrecover: verify the recovered signer matches expected wallet ---
    // Parse the expected wallet address
    let expected_address = Address::from_str(expected_wallet)
        .map_err(|e| format!("Invalid wallet address: {}", e))?;

    // Compute the EIP-191 hash of the calldata (same as Solidity's keccak256)
    let message_hash = keccak256(&calldata_bytes);
    let digest = H256::from(message_hash);

    // Parse the 65-byte signature (r[32] || s[32] || v[1])
    let sig = Signature::try_from(sig_bytes.as_slice())
        .map_err(|e| format!("Failed to parse ECDSA signature: {}", e))?;

    // Recover the signer address from the signature
    let recovered_address = sig
        .recover(digest)
        .map_err(|e| format!("ECDSA recovery failed: {}", e))?;

    // Verify the recovered address matches the expected wallet
    if recovered_address != expected_address {
        return Err(format!(
            "Signature signer mismatch: recovered={:#x}, expected={:#x}",
            recovered_address, expected_address
        ));
    }

    Ok(())
}

/// POST /api/v1/transactions — submit a meta-transaction for relay
pub async fn handler(
    ctx: web::Data<RelayerContext>,
    body: web::Json<SendTxRequest>,
) -> HttpResponse {
    let req = body.into_inner();

    // --- Security: verify signature over calldata before relaying ---
    if let Err(reason) = verify_transaction_signature(
        &req.calldata,
        &req.signature,
        &req.wallet_address,
    ) {
        tracing::warn!(
            "Rejected tx: chain={}, wallet={}, reason={}",
            req.chain_id,
            req.wallet_address,
            reason
        );
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Signature verification failed: {}", reason),
        }));
    }

    tracing::info!("Relay tx: chain={}, wallet={}", req.chain_id, req.wallet_address);

    // 1. Validate signature against wallet keyset (structural check done above)
    // 2. Simulate via eth_call
    // 3. Estimate gas + L1 data fee (Arbitrum)
    // 4. Check fee token balance covers relayer cost
    // 5. Build EVM transaction (ModuleMain.execute calldata)
    // 6. Sign with relayer private key
    // 7. Push to Redis stream for async submission
    // 8. Return pending tx ID

    HttpResponse::Ok().json(serde_json::json!({
        "status": "queued",
        "txId": "pending-xxx",
    }))
}
