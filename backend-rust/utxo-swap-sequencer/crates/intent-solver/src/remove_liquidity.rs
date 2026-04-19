use types::intent::PairInfo;
use num_bigint::BigUint;

/// Validate and calculate remove liquidity amounts
/// Returns (asset_x_amount, asset_y_amount) that user will receive
///
/// BL-H4 fix: Unified with lib.rs — uses BigUint to handle large values that would
/// overflow u128::MAX with checked_mul. Previously this function used checked_mul which
/// would incorrectly fail for large LP positions where lp_amount * reserve > u128::MAX.
///
/// SECURITY (H-1, M-4): Uses BigUint for safe arithmetic
pub fn solve_remove_liquidity(
    lp_amount: u128,
    min_asset_x: u128,
    min_asset_y: u128,
    pair: &PairInfo,
) -> Result<(u128, u128), RemoveLiquidityError> {
    if lp_amount == 0 {
        return Err(RemoveLiquidityError::ZeroLpAmount);
    }

    if pair.total_lp_supply == 0 {
        return Err(RemoveLiquidityError::InsufficientLiquidity);
    }

    if lp_amount > pair.total_lp_supply {
        return Err(RemoveLiquidityError::InsufficientLiquidity);
    }

    // BL-H4 fix: Use BigUint (same as lib.rs calculate_remove_liquidity) to prevent
    // overflow for large values where lp_amount * reserve_x > u128::MAX
    let lp_big = BigUint::from(lp_amount);
    let reserve_x_big = BigUint::from(pair.asset_x_reserve);
    let reserve_y_big = BigUint::from(pair.asset_y_reserve);
    let total_lp_big = BigUint::from(pair.total_lp_supply);

    let asset_x_big = &lp_big * &reserve_x_big / &total_lp_big;
    let asset_y_big = &lp_big * &reserve_y_big / &total_lp_big;

    // Convert back to u128
    let asset_x = from_big(&asset_x_big).ok_or(RemoveLiquidityError::InsufficientLiquidity)?;
    let asset_y = from_big(&asset_y_big).ok_or(RemoveLiquidityError::InsufficientLiquidity)?;

    // SECURITY (M-4): Verify no underflow would occur when subtracting from reserves
    if asset_x > pair.asset_x_reserve || asset_y > pair.asset_y_reserve {
        return Err(RemoveLiquidityError::InsufficientLiquidity);
    }

    if asset_x < min_asset_x {
        return Err(RemoveLiquidityError::SlippageExceeded {
            expected: min_asset_x,
            actual: asset_x,
            asset: "X",
        });
    }

    if asset_y < min_asset_y {
        return Err(RemoveLiquidityError::SlippageExceeded {
            expected: min_asset_y,
            actual: asset_y,
            asset: "Y",
        });
    }

    Ok((asset_x, asset_y))
}

/// Convert BigUint back to u128, returning None on overflow
fn from_big(v: &BigUint) -> Option<u128> {
    let bytes = v.to_bytes_le();
    if bytes.len() > 16 {
        return None;
    }
    let mut arr = [0u8; 16];
    arr[..bytes.len()].copy_from_slice(&bytes);
    Some(u128::from_le_bytes(arr))
}

#[derive(Debug, thiserror::Error)]
pub enum RemoveLiquidityError {
    #[error("LP amount is zero")]
    ZeroLpAmount,
    #[error("Insufficient liquidity in pool")]
    InsufficientLiquidity,
    #[error("Slippage exceeded for asset {asset}: expected >= {expected}, got {actual}")]
    SlippageExceeded {
        expected: u128,
        actual: u128,
        asset: &'static str,
    },
}
