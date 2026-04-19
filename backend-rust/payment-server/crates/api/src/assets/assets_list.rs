use actix_web::{web, HttpResponse};
use crate::auth_middleware::AuthenticatedUser;

/// Validate Ethereum address format: optional 0x prefix + 40 hex chars
fn validate_eth_address(addr: &str) -> bool {
    let clean = addr.strip_prefix("0x").unwrap_or(addr);
    clean.len() == 40 && hex::decode(clean).is_ok()
}

/// GET /api/v1/assets/list?address=0x...&chainId=42161
/// FINDING-20: Input validation on address query param.
pub async fn handler(_auth: AuthenticatedUser, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let address = query.get("address").cloned().unwrap_or_default();

    // Validate address format
    if address.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Missing required 'address' query parameter"
        }));
    }
    if !validate_eth_address(&address) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid 'address': must be 0x + 40 hex characters"
        }));
    }

    // Validate chainId if provided
    if let Some(chain_id_str) = query.get("chainId") {
        if chain_id_str.parse::<u64>().is_err() {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid 'chainId': must be a positive integer"
            }));
        }
    }

    // Query ERC20 token balances using Multicall3
    // 1. Build multicall calldata for each token: balanceOf(wallet_address)
    // 2. Submit eth_call to RPC
    // 3. Decode response into token/balance pairs
    // In production: use reqwest + Multicall3 (0xcA11bde05977b3631167028862bE2a173976CA11)
    // to batch-query ERC20 balances via eth_call
    HttpResponse::Ok().json(serde_json::json!({"assets": []}))
}
