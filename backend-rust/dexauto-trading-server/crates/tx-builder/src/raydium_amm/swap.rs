use anyhow::Result;
use serde::{Deserialize, Serialize};

use super::core::math;

/// Raydium AMM pool state (fetched from on-chain)
#[derive(Debug, Clone, Deserialize)]
pub struct AmmPoolState {
    pub amm_id: String,
    pub base_mint: String,
    pub quote_mint: String,
    pub base_vault: String,
    pub quote_vault: String,
    pub base_reserve: u64,
    pub quote_reserve: u64,
    pub fee_numerator: u64,
    pub fee_denominator: u64,
}

/// Swap parameters
#[derive(Debug, Serialize)]
pub struct RaydiumSwapParams {
    pub amm_id: String,
    pub input_mint: String,
    pub output_mint: String,
    pub amount_in: u64,
    pub min_amount_out: u64,
    pub base_in: bool,
}

/// Calculate swap and build instruction data
pub fn prepare_swap(
    pool: &AmmPoolState,
    input_mint: &str,
    amount_in: u64,
    slippage_bps: u16,
    base_in: bool,
) -> Result<RaydiumSwapParams> {
    let (pool_in, pool_out) = if base_in {
        (pool.base_reserve, pool.quote_reserve)
    } else {
        (pool.quote_reserve, pool.base_reserve)
    };

    let amount_out = math::calculate_swap_exact_in(
        amount_in, pool_in, pool_out,
        pool.fee_numerator, pool.fee_denominator,
    );

    // Apply slippage with ceiling division so min_amount_out is never understated (Audit #34).
    // Formula: ceil(amount_out * (10000 - slippage_bps) / 10000)
    let numerator = amount_out as u128 * (10000 - slippage_bps as u128);
    let min_amount_out = ((numerator + 9999) / 10000) as u64;

    let output_mint = if base_in {
        pool.quote_mint.clone()
    } else {
        pool.base_mint.clone()
    };

    Ok(RaydiumSwapParams {
        amm_id: pool.amm_id.clone(),
        input_mint: input_mint.to_string(),
        output_mint,
        amount_in,
        min_amount_out,
        base_in,
    })
}

/// Build Raydium AMM swap instruction bytes
/// Layout: [instruction_type(1), amount_in(8), min_out(8)]
pub fn build_swap_instruction_data(amount_in: u64, min_amount_out: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(17);
    data.push(9); // Raydium swap instruction discriminator
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_amount_out.to_le_bytes());
    data
}
