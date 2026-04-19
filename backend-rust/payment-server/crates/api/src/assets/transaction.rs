use actix_web::{web, HttpResponse};
use crate::auth_middleware::AuthenticatedUser;
use crate::context::PaymentContext;
use serde::Deserialize;

/// Transaction submission request
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRequest {
    /// Target chain ID (42161 = Arbitrum, 137 = Polygon, 56 = BSC)
    pub chain_id: u64,
    /// ABI-encoded calldata for the smart account
    pub calldata: String,
    /// EIP-1271 signature from the user's keyset
    pub signature: String,
}

/// POST /api/v1/assets/transaction — submit signed transaction via relayer (CRIT-02 fix)
pub async fn handler(
    auth: AuthenticatedUser,
    ctx: web::Data<PaymentContext>,
    body: web::Json<TransactionRequest>,
) -> HttpResponse {
    let masked_user = common::mask_address(&auth.user_id);

    // Step 1: Validate chain_id is supported
    let supported_chains: &[u64] = &[42161, 137, 56];
    if !supported_chains.contains(&body.chain_id) {
        tracing::warn!("Transaction rejected: unsupported chain_id={} from user={}", body.chain_id, masked_user);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Unsupported chain_id: {}. Supported: {:?}", body.chain_id, supported_chains)
        }));
    }

    // Step 2: Validate calldata is non-empty valid hex
    let clean_calldata = body.calldata.strip_prefix("0x").unwrap_or(&body.calldata);
    if clean_calldata.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "calldata must not be empty"
        }));
    }
    if hex::decode(clean_calldata).is_err() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "calldata must be valid hex"
        }));
    }

    // Step 3: Validate signature is non-empty valid hex
    let clean_sig = body.signature.strip_prefix("0x").unwrap_or(&body.signature);
    if clean_sig.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "signature must not be empty"
        }));
    }
    if hex::decode(clean_sig).is_err() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "signature must be valid hex"
        }));
    }

    // Step 4: Submit via relayer client
    let relayer = api_utils::relayer_client::RelayerClient::new(
        &ctx.config.relayer_url,
        &ctx.config.relayer_api_key,
        &ctx.config.relayer_private_key,
    );

    tracing::info!(
        "Submitting transaction: chain_id={}, user={}, calldata_len={}",
        body.chain_id, masked_user, clean_calldata.len()
    );

    match relayer.submit_transaction(body.chain_id, &body.calldata, &body.signature).await {
        Ok(tx_id) => {
            tracing::info!("Transaction submitted successfully: tx_id={}, user={}", tx_id, masked_user);
            HttpResponse::Ok().json(serde_json::json!({
                "status": "submitted",
                "txId": tx_id,
                "chainId": body.chain_id,
            }))
        }
        Err(e) => {
            tracing::error!("Transaction submission failed for user={}: {}", masked_user, e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Transaction submission failed",
                "details": e.to_string(),
            }))
        }
    }
}
