use super::*;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CheckError {
    #[error("Intent encoding invalid")]
    EncodingInvalid,
    #[error("Pool type hash not found")]
    PoolNotFound,
    #[error("Asset X type hash does not match pool")]
    AssetXTypeHashUnmatch,
    #[error("Asset Y type hash does not match pool")]
    AssetYTypeHashUnmatch,
    #[error("Amount in is zero")]
    ZeroAmountIn,
    #[error("Min amount out is zero")]
    ZeroMinAmountOut,
    #[error("Invalid sequencer lock")]
    SequencerLockRequired,
    #[error("Invalid intent unlock")]
    InvalidIntentUnlock,
    #[error("Invalid add liquidity parameters")]
    InvalidAddLiquidityIntent,
    #[error("Invalid remove liquidity parameters")]
    InvalidRemoveLiquidityIntent,
    #[error("Cell count not match")]
    CellCountNotMatch,
    #[error("Liquidity amount not match")]
    LiquidityAmountNotMatch,
    #[error("Asset X amount not match")]
    AssetXAmountNotMatch,
    #[error("Asset Y amount not match")]
    AssetYAmountNotMatch,
    #[error("Intent not fulfilled — output amount less than min_amount_out")]
    IntentNotFulfilled,
}

/// Validate a parsed intent against pool state
pub fn check_intent(intent: &ParsedIntent, pair: &PairInfo) -> Result<(), CheckError> {
    // Check pool exists
    if pair.pool_type_hash != intent.pool_type_hash {
        return Err(CheckError::PoolNotFound);
    }

    // BL-M3 fix: Validate fee_rate is within valid bounds (0..=10000 basis points).
    // A fee_rate > 10000 means >100% fee which is invalid and would cause
    // zero output or overflow in swap calculations.
    if pair.fee_rate > 10000 {
        return Err(CheckError::IntentNotFulfilled);
    }

    // Check amounts
    if intent.amount_in == 0 {
        return Err(CheckError::ZeroAmountIn);
    }
    if intent.min_amount_out == 0 {
        return Err(CheckError::ZeroMinAmountOut);
    }

    // Intent-type specific checks
    match intent.intent_type {
        IntentType::SwapExactInputForOutput => {
            check_swap_exact_input(intent, pair)?;
        }
        IntentType::SwapInputForExactOutput => {
            check_swap_exact_output(intent, pair)?;
        }
        IntentType::AddLiquidity => {
            check_add_liquidity(intent, pair)?;
        }
        IntentType::RemoveLiquidity => {
            check_remove_liquidity(intent, pair)?;
        }
    }

    Ok(())
}

/// Check swap with exact input amount
/// SECURITY (H-1): Uses BigUint to prevent overflow — matches solver precision
fn check_swap_exact_input(intent: &ParsedIntent, pair: &PairInfo) -> Result<(), CheckError> {
    use num_bigint::BigUint;

    let direction = intent
        .swap_type
        .ok_or(CheckError::EncodingInvalid)?;

    let (reserve_in, reserve_out) = match direction {
        SwapDirection::XToY => (pair.asset_x_reserve, pair.asset_y_reserve),
        SwapDirection::YToX => (pair.asset_y_reserve, pair.asset_x_reserve),
    };

    // SECURITY (H-1): Use BigUint (same unified formula as solver - H-2)
    let amount_in = BigUint::from(intent.amount_in);
    let fee_complement = BigUint::from(10000u64.saturating_sub(pair.fee_rate));
    let base = BigUint::from(10000u64);

    let fee_adjusted = &amount_in * &fee_complement;
    let numerator = &fee_adjusted * BigUint::from(reserve_out);
    let denominator = BigUint::from(reserve_in) * &base + &fee_adjusted;

    if denominator == BigUint::from(0u32) {
        return Err(CheckError::IntentNotFulfilled);
    }

    let amount_out_big = &numerator / &denominator;

    // Convert back to u128 for comparison
    let amount_out_bytes = amount_out_big.to_bytes_le();
    if amount_out_bytes.len() > 16 {
        return Err(CheckError::IntentNotFulfilled);
    }
    let mut arr = [0u8; 16];
    arr[..amount_out_bytes.len()].copy_from_slice(&amount_out_bytes);
    let amount_out = u128::from_le_bytes(arr);

    if amount_out < intent.min_amount_out {
        return Err(CheckError::IntentNotFulfilled);
    }

    Ok(())
}

/// Check swap with exact output amount
/// SECURITY (H-1): Uses BigUint to prevent overflow — matches solver precision
fn check_swap_exact_output(intent: &ParsedIntent, pair: &PairInfo) -> Result<(), CheckError> {
    use num_bigint::BigUint;

    let direction = intent
        .swap_type
        .ok_or(CheckError::EncodingInvalid)?;

    let (reserve_in, reserve_out) = match direction {
        SwapDirection::XToY => (pair.asset_x_reserve, pair.asset_y_reserve),
        SwapDirection::YToX => (pair.asset_y_reserve, pair.asset_x_reserve),
    };

    if intent.min_amount_out >= reserve_out {
        return Err(CheckError::IntentNotFulfilled);
    }

    // SECURITY (H-1): Use BigUint (same unified formula as solver - H-2)
    let numerator = BigUint::from(reserve_in) * BigUint::from(intent.min_amount_out) * BigUint::from(10000u64);
    let reserve_diff = reserve_out - intent.min_amount_out; // safe: checked above
    let fee_complement = BigUint::from(10000u64.saturating_sub(pair.fee_rate));
    let denominator = BigUint::from(reserve_diff) * &fee_complement;

    if denominator == BigUint::from(0u32) {
        return Err(CheckError::IntentNotFulfilled);
    }

    let amount_in_big = &numerator / &denominator + BigUint::from(1u32);

    // Convert back to u128 for comparison
    let amount_in_bytes = amount_in_big.to_bytes_le();
    if amount_in_bytes.len() > 16 {
        return Err(CheckError::IntentNotFulfilled);
    }
    let mut arr = [0u8; 16];
    arr[..amount_in_bytes.len()].copy_from_slice(&amount_in_bytes);
    let amount_in_required = u128::from_le_bytes(arr);

    if intent.amount_in < amount_in_required {
        return Err(CheckError::IntentNotFulfilled);
    }

    Ok(())
}

/// Check add liquidity intent
/// SECURITY (L-4): Enhanced validation — checks both amounts and asset type hash matching
fn check_add_liquidity(intent: &ParsedIntent, pair: &PairInfo) -> Result<(), CheckError> {
    if intent.amount_in == 0 {
        return Err(CheckError::InvalidAddLiquidityIntent);
    }
    // L-4: Validate min_amount_out (used as asset_y amount) is also > 0
    if intent.min_amount_out == 0 {
        return Err(CheckError::InvalidAddLiquidityIntent);
    }

    // L-4: Validate asset type hashes match the pool's actual assets
    // Reject intents where the pool type hash doesn't match
    if intent.pool_type_hash != pair.pool_type_hash {
        return Err(CheckError::AssetXTypeHashUnmatch);
    }

    // L-22: Minimum liquidity check for pool creation
    // If pool is empty (initial liquidity), require minimum amounts
    // BL-M5 fix: Increased from 1000 to 1_000_000 (1e6) to prevent dust pool manipulation
    // and "first depositor" attacks where an attacker creates a pool with tiny amounts
    // to manipulate the initial price ratio.
    const MIN_INITIAL_LIQUIDITY: u128 = 1_000_000;
    if pair.total_lp_supply == 0 {
        if intent.amount_in < MIN_INITIAL_LIQUIDITY || intent.min_amount_out < MIN_INITIAL_LIQUIDITY {
            return Err(CheckError::InvalidAddLiquidityIntent);
        }
    }

    Ok(())
}

/// Check remove liquidity intent
fn check_remove_liquidity(intent: &ParsedIntent, pair: &PairInfo) -> Result<(), CheckError> {
    if intent.amount_in == 0 {
        return Err(CheckError::InvalidRemoveLiquidityIntent);
    }
    if intent.amount_in > pair.total_lp_supply {
        return Err(CheckError::LiquidityAmountNotMatch);
    }
    Ok(())
}
