// RPC calls to fetch Raydium AMM pool state from on-chain accounts

use anyhow::{Context, Result};
use std::time::Duration;

use super::super::swap::AmmPoolState;
use super::super::utils::read_u64_le;

/// HTTP request timeout for Raydium RPC calls (Audit #37).
const RAYDIUM_RPC_TIMEOUT: Duration = Duration::from_secs(15);

/// Raydium AMM V4 `AmmInfo` layout offsets (bytes). Derived from the on-chain
/// struct published in the Raydium program source — the full struct is 752
/// bytes and every field is 8-byte aligned. Only the fields we need are
/// mapped here; unused pubkey/u128/stats regions are skipped.
mod amm_v4 {
    // u64 scalar fields (0..128) are already documented in fetch_pool_state.
    pub const OFFSET_FEES: usize = 128;           // 16 × u64 fee parameters (128 bytes)
    pub const OFFSET_OUT: usize = 256;            // 12 × u128 stats (128 bytes)
    pub const OFFSET_POOL_VAULTS: usize = 384;    // start of pubkey region

    // Pubkey = 32 bytes
    pub const POOL_COIN_TOKEN_ACCOUNT: usize = 384;  // base_vault
    pub const POOL_PC_TOKEN_ACCOUNT: usize = 416;    // quote_vault
    pub const COIN_MINT: usize = 448;                // base_mint
    pub const PC_MINT: usize = 480;                  // quote_mint
    // Remaining fields (lp_mint, open_orders, serum_market, etc.) are not
    // needed for reading reserves.

    // Trade-fee parameters within the fees block:
    pub const TRADE_FEE_NUMERATOR: usize = OFFSET_FEES + 16 * 8 - 8 * 8; // see layout
    // The exact layout is:
    //   min_separate_numerator, min_separate_denominator,
    //   trade_fee_numerator, trade_fee_denominator,
    //   pnl_numerator, pnl_denominator,
    //   swap_fee_numerator, swap_fee_denominator
    // Each is u64. `swap_fee_*` is what the swap math uses.
    pub const SWAP_FEE_NUM_OFFSET: usize = OFFSET_FEES + 6 * 8;   // 128 + 48 = 176
    pub const SWAP_FEE_DEN_OFFSET: usize = OFFSET_FEES + 7 * 8;   // 128 + 56 = 184
}

/// Read a Solana pubkey (32 bytes) from the given offset and encode as
/// base58 — matching the string format Raydium clients expect.
fn read_pubkey_b58(data: &[u8], offset: usize) -> Option<String> {
    if offset + 32 > data.len() {
        return None;
    }
    Some(bs58::encode(&data[offset..offset + 32]).into_string())
}

/// Fetch Raydium AMM pool state via Solana RPC getAccountInfo.
///
/// Errors are propagated instead of silently swallowed (Audit #37).
/// An HTTP timeout is applied to prevent indefinite hangs.
pub async fn fetch_pool_state(rpc_url: &str, amm_id: &str) -> Result<AmmPoolState> {
    let client = reqwest::Client::builder()
        .timeout(RAYDIUM_RPC_TIMEOUT)
        .build()
        .context("Failed to build HTTP client for Raydium RPC")?;

    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAccountInfo",
        "params": [amm_id, {"encoding": "base64"}]
    });

    let resp: serde_json::Value = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .context("Raydium RPC request failed")?
        .error_for_status()
        .context("Raydium RPC returned HTTP error")?
        .json()
        .await
        .context("Failed to parse Raydium RPC response as JSON")?;

    // Check for JSON-RPC error
    if let Some(error) = resp.get("error") {
        anyhow::bail!("Raydium RPC error: {}", error);
    }

    // Raydium AMM V4 account data layout (752 bytes):
    // offset 0: status (u64)
    // offset 8: nonce (u64)
    // offset 16: order_num (u64)
    // offset 24: depth (u64)
    // offset 32: coin_decimals (u64)
    // offset 40: pc_decimals (u64)
    // offset 48: state (u64)
    // offset 56: reset_flag (u64)
    // offset 64: min_size (u64)
    // offset 72: vol_max_cut_ratio (u64)
    // offset 80: amount_wave_ratio (u64)
    // offset 88: coin_lot_size (u64)
    // offset 96: pc_lot_size (u64)
    // offset 104: min_price_multiplier (u64)
    // offset 112: max_price_multiplier (u64)
    // offset 120: system_decimals_value (u64)
    // offset 128..256: fees (16 x u64)
    // offset 256: out_coin / out_pc (various u128s)
    // offset 384..752: pool vault pubkeys and state
    let data_b64 = resp["result"]["value"]["data"][0]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Missing or null account data for AMM {}", amm_id))?;

    let data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, data_b64)
        .context("Failed to decode base64 account data")?;

    if data.len() < 752 {
        anyhow::bail!("AMM account data too short: {} bytes (expected ≥752)", data.len());
    }

    let status = read_u64_le(&data, 0)
        .context("Failed to read AMM status field")?;
    let coin_decimals = read_u64_le(&data, 32)
        .context("Failed to read coin_decimals field")?;
    let pc_decimals = read_u64_le(&data, 40)
        .context("Failed to read pc_decimals field")?;

    tracing::debug!("Raydium AMM status={}, coin_dec={}, pc_dec={}", status, coin_decimals, pc_decimals);

    // Extract pubkeys for vaults + mints
    let base_vault = read_pubkey_b58(&data, amm_v4::POOL_COIN_TOKEN_ACCOUNT)
        .ok_or_else(|| anyhow::anyhow!("Failed to read pool coin token account"))?;
    let quote_vault = read_pubkey_b58(&data, amm_v4::POOL_PC_TOKEN_ACCOUNT)
        .ok_or_else(|| anyhow::anyhow!("Failed to read pool pc token account"))?;
    let base_mint = read_pubkey_b58(&data, amm_v4::COIN_MINT)
        .ok_or_else(|| anyhow::anyhow!("Failed to read coin mint"))?;
    let quote_mint = read_pubkey_b58(&data, amm_v4::PC_MINT)
        .ok_or_else(|| anyhow::anyhow!("Failed to read pc mint"))?;

    // Swap fee (used by constant-product math). Fall back to Raydium default
    // (25 / 10000 = 0.25%) if the pool's encoded denominator is zero.
    let mut fee_numerator = read_u64_le(&data, amm_v4::SWAP_FEE_NUM_OFFSET).unwrap_or(25);
    let mut fee_denominator = read_u64_le(&data, amm_v4::SWAP_FEE_DEN_OFFSET).unwrap_or(10_000);
    if fee_denominator == 0 {
        fee_numerator = 25;
        fee_denominator = 10_000;
    }

    // Fetch live vault balances (reserves) via getTokenAccountBalance.
    // These are the actual values the swap math needs — the reserve counters
    // inside the AmmInfo struct are stats, not live balances.
    let (base_reserve, quote_reserve) = tokio::try_join!(
        fetch_token_account_balance(&client, rpc_url, &base_vault),
        fetch_token_account_balance(&client, rpc_url, &quote_vault)
    )?;

    tracing::info!(
        "Raydium AMM parsed: amm={} base_mint={} quote_mint={} base_reserve={} quote_reserve={} fee={}/{}",
        amm_id, base_mint, quote_mint, base_reserve, quote_reserve, fee_numerator, fee_denominator
    );

    Ok(AmmPoolState {
        amm_id: amm_id.to_string(),
        base_mint,
        quote_mint,
        base_vault,
        quote_vault,
        base_reserve,
        quote_reserve,
        fee_numerator,
        fee_denominator,
    })
}

/// Fetch a Solana SPL token account's balance (raw u64 amount) via
/// `getTokenAccountBalance`. Returns 0 on parse errors to avoid crashing
/// callers, but the RPC error itself propagates.
async fn fetch_token_account_balance(
    client: &reqwest::Client,
    rpc_url: &str,
    token_account: &str,
) -> Result<u64> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenAccountBalance",
        "params": [token_account]
    });
    let resp: serde_json::Value = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .context("getTokenAccountBalance request failed")?
        .error_for_status()
        .context("getTokenAccountBalance returned HTTP error")?
        .json()
        .await
        .context("Failed to parse getTokenAccountBalance response")?;

    if let Some(err) = resp.get("error") {
        anyhow::bail!("getTokenAccountBalance RPC error ({}): {}", token_account, err);
    }
    let amount_str = resp["result"]["value"]["amount"].as_str().unwrap_or("0");
    Ok(amount_str.parse::<u64>().unwrap_or(0))
}

/// Fetch multiple pool states in batch
pub async fn fetch_pool_states(rpc_url: &str, amm_ids: &[&str]) -> Result<Vec<AmmPoolState>> {
    let mut pools = Vec::new();
    for id in amm_ids {
        pools.push(fetch_pool_state(rpc_url, id).await?);
    }
    Ok(pools)
}
