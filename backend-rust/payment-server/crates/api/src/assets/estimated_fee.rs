use actix_web::{web, HttpResponse};
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, Bytes, TransactionRequest, U256};
use std::str::FromStr;
use crate::auth_middleware::AuthenticatedUser;
use crate::context::PaymentContext;

// BUG-17 FIX: Real fee estimation via ethers `eth_estimateGas` + `eth_gasPrice`.
// Falls back to conservative defaults when the RPC is unreachable so the
// endpoint degrades gracefully instead of 5xx-ing.

/// Fallback gas estimate (Arbitrum contract call upper bound).
const FALLBACK_GAS_ESTIMATE: u64 = 300_000;
/// Fallback gas price in Gwei. Arbitrum L2 gas is typically < 1 Gwei.
const FALLBACK_GAS_PRICE_GWEI: u64 = 1;

/// Wei per Gwei conversion factor (10^9)
const WEI_PER_GWEI: u64 = 1_000_000_000;

/// Wei per Ether conversion factor (10^18)
const WEI_PER_ETHER: u64 = 1_000_000_000_000_000_000;

/// Divisor for formatting the fractional part of ETH (10^10, for 8 decimal places)
const ETHER_FRAC_DIVISOR: u64 = 10_000_000_000;

/// Validate Ethereum address format: optional 0x prefix + 40 hex chars
fn validate_eth_address(addr: &str) -> bool {
    let clean = addr.strip_prefix("0x").unwrap_or(addr);
    clean.len() == 40 && hex::decode(clean).is_ok()
}

/// Validate hex-encoded calldata format
fn validate_calldata(data: &str) -> bool {
    if data.is_empty() {
        return true; // empty calldata is valid (simple transfer)
    }
    let clean = data.strip_prefix("0x").unwrap_or(data);
    // Calldata must be valid hex and even length
    clean.len() % 2 == 0 && hex::decode(clean).is_ok()
}

/// Result of a gas estimation attempt.
struct FeeEstimate {
    gas: U256,
    gas_price_wei: U256,
    /// `true` when the values came from a real RPC; `false` means fallback defaults.
    dynamic: bool,
}

/// Query the configured Arbitrum RPC for real gas and gas-price. Returns a
/// fallback estimate on any failure so the endpoint never 5xx's.
async fn estimate_fee(rpc_url: &str, to: &str, data: &str) -> FeeEstimate {
    let fallback = FeeEstimate {
        gas: U256::from(FALLBACK_GAS_ESTIMATE),
        gas_price_wei: U256::from(FALLBACK_GAS_PRICE_GWEI) * U256::from(WEI_PER_GWEI),
        dynamic: false,
    };

    if rpc_url.is_empty() {
        tracing::debug!("arbitrum_rpc_url not configured; returning fallback fee");
        return fallback;
    }
    let provider = match Provider::<Http>::try_from(rpc_url) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("Bad arbitrum_rpc_url ({}): {}", rpc_url, e);
            return fallback;
        }
    };

    // Build the transaction request — only attach fields that parse cleanly.
    let mut tx = TransactionRequest::new();
    if let Ok(addr) = Address::from_str(to.strip_prefix("0x").unwrap_or(to)) {
        tx = tx.to(addr);
    }
    if !data.is_empty() {
        if let Ok(bytes) = hex::decode(data.strip_prefix("0x").unwrap_or(data)) {
            tx = tx.data(Bytes::from(bytes));
        }
    }

    let typed_tx = tx.into();
    let gas = match provider.estimate_gas(&typed_tx, None).await {
        Ok(g) => {
            // 20% buffer against block-to-block variance.
            g.saturating_mul(U256::from(120)) / U256::from(100)
        }
        Err(e) => {
            tracing::warn!("eth_estimateGas failed ({}); using fallback gas", e);
            return fallback;
        }
    };
    let gas_price_wei = match provider.get_gas_price().await {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("eth_gasPrice failed ({}); using fallback price", e);
            return FeeEstimate { gas, ..fallback };
        }
    };
    FeeEstimate { gas, gas_price_wei, dynamic: true }
}

/// GET /api/v1/assets/estimated-fee — estimate gas + L1 data fee
/// FINDING-20: Input validation on address and calldata query params.
pub async fn handler(
    ctx: web::Data<PaymentContext>,
    _auth: AuthenticatedUser,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let to_addr = query.get("to").cloned().unwrap_or_default();
    let calldata = query.get("data").cloned().unwrap_or_default();

    // Validate address format
    if !to_addr.is_empty() && !validate_eth_address(&to_addr) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid 'to' address: must be 0x + 40 hex characters"
        }));
    }
    // Validate calldata format
    if !validate_calldata(&calldata) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid 'data' calldata: must be valid hex (even length, optional 0x prefix)"
        }));
    }

    let est = estimate_fee(&ctx.config.arbitrum_rpc_url, &to_addr, &calldata).await;

    // fee_wei = gas * gas_price_wei. Use U256 arithmetic to avoid overflow.
    let fee_wei = est.gas.saturating_mul(est.gas_price_wei);

    // Format wei → ETH with 8 fractional digits, purely via integer math.
    let wei_per_eth = U256::from(WEI_PER_ETHER);
    let whole = fee_wei / wei_per_eth;
    let frac = fee_wei % wei_per_eth;
    let frac_8 = (frac / U256::from(ETHER_FRAC_DIVISOR)).as_u64();
    let fee_eth = format!("{}.{:08}", whole, frac_8);

    HttpResponse::Ok().json(serde_json::json!({
        "fee": fee_eth,
        "feeToken": "ETH",
        "estimatedGas": est.gas.as_u64(),
        "gasPriceWei": est.gas_price_wei.to_string(),
        "dynamic": est.dynamic,
        "to": to_addr,
    }))
}
