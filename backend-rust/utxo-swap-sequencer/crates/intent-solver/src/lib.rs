pub mod remove_liquidity;
pub mod tx;

use types::intent::{
    BurnEvent, CkbScript, IntentErrorReason, MintEvent, ParsedIntent, PairInfo, RefundedIntent,
    SwapDirection, SwapEvent,
};

/// Result of solving a batch of intents against a pool
#[derive(Debug)]
pub struct SolverResult {
    /// Successfully processed swap events
    pub swap_events: Vec<SwapEvent>,
    /// Successfully processed mint events (add liquidity)
    pub mint_events: Vec<MintEvent>,
    /// Successfully processed burn events (remove liquidity)
    pub burn_events: Vec<BurnEvent>,
    /// Refunded intents (failed validation)
    pub refunded: Vec<RefundedIntent>,
    /// New pool state after processing
    pub new_pair_info: PairInfo,
}

/// AMM constant-product math
/// x * y = k (invariant)
///
/// SECURITY (H-1): All arithmetic uses checked operations or BigUint to prevent overflow.
/// SECURITY (H-2): Single unified formula used by both solver and checker.

use num_bigint::BigUint;

/// Convert u128 to BigUint for safe arithmetic
fn to_big(v: u128) -> BigUint {
    BigUint::from(v)
}

/// Convert BigUint back to u128, returning None on overflow
fn from_big(v: &BigUint) -> Option<u128> {
    
    // BigUint does not overflow, but we need it to fit in u128
    let bytes = v.to_bytes_le();
    if bytes.len() > 16 {
        return None;
    }
    let mut arr = [0u8; 16];
    arr[..bytes.len()].copy_from_slice(&bytes);
    Some(u128::from_le_bytes(arr))
}

/// Error type for AMM calculation failures
#[derive(Debug, Clone, thiserror::Error)]
pub enum AmmError {
    #[error("Zero reserve or amount")]
    ZeroInput,
    #[error("Arithmetic overflow in AMM calculation")]
    Overflow,
    #[error("Insufficient liquidity")]
    InsufficientLiquidity,
    #[error("Division by zero")]
    DivisionByZero,
}

/// Calculate swap output amount (exact input) — unified formula (H-2)
/// Formula: amount_out = (amount_in * (10000 - fee_rate) * reserve_out) / (reserve_in * 10000 + amount_in * (10000 - fee_rate))
///
/// Uses BigUint to prevent overflow (H-1)
pub fn calculate_swap_exact_input(
    amount_in: u128,
    reserve_in: u128,
    reserve_out: u128,
    fee_rate_bps: u64,
) -> Result<u128, AmmError> {
    if reserve_in == 0 || reserve_out == 0 || amount_in == 0 {
        return Err(AmmError::ZeroInput);
    }

    let fee_adjusted = to_big(amount_in) * to_big(10000u128.saturating_sub(fee_rate_bps as u128));
    let numerator = &fee_adjusted * to_big(reserve_out);
    let denominator = to_big(reserve_in) * to_big(10000u128) + &fee_adjusted;

    if denominator == BigUint::from(0u32) {
        return Err(AmmError::DivisionByZero);
    }

    let result = &numerator / &denominator;

    // BL-H1 fix: Reject zero-output swaps (defense-in-depth against 1-wei attacks)
    if result == BigUint::from(0u32) {
        return Err(AmmError::ZeroInput);
    }

    from_big(&result).ok_or(AmmError::Overflow)
}

/// Calculate swap input amount required (exact output) — unified formula (H-2)
/// Formula: amount_in = (reserve_in * amount_out * 10000) / ((reserve_out - amount_out) * (10000 - fee_rate)) + 1
///
/// Uses BigUint to prevent overflow (H-1)
pub fn calculate_swap_exact_output(
    amount_out: u128,
    reserve_in: u128,
    reserve_out: u128,
    fee_rate_bps: u64,
) -> Result<u128, AmmError> {
    if reserve_in == 0 || reserve_out == 0 {
        return Err(AmmError::ZeroInput);
    }
    if amount_out >= reserve_out {
        return Err(AmmError::InsufficientLiquidity);
    }

    let numerator = to_big(reserve_in) * to_big(amount_out) * to_big(10000u128);
    let denominator = to_big(reserve_out - amount_out) * to_big(10000u128.saturating_sub(fee_rate_bps as u128));

    if denominator == BigUint::from(0u32) {
        return Err(AmmError::DivisionByZero);
    }

    let result = &numerator / &denominator + BigUint::from(1u32);
    from_big(&result).ok_or(AmmError::Overflow)
}

/// Calculate LP tokens to mint for adding liquidity
/// If pool is empty: sqrt(amount_x * amount_y)
/// Otherwise: min(amount_x * total_lp / reserve_x, amount_y * total_lp / reserve_y)
///
/// Uses BigUint to prevent overflow (H-1)
pub fn calculate_add_liquidity(
    amount_x: u128,
    amount_y: u128,
    reserve_x: u128,
    reserve_y: u128,
    total_lp: u128,
) -> Result<(u128, u128, u128), AmmError> {
    if amount_x == 0 || amount_y == 0 {
        return Err(AmmError::ZeroInput);
    }

    if total_lp == 0 {
        // Initial liquidity — use geometric mean with BigUint
        let product = to_big(amount_x) * to_big(amount_y);
        let lp = product.sqrt();
        let lp_val = from_big(&lp).ok_or(AmmError::Overflow)?;
        if lp_val == 0 {
            return Err(AmmError::ZeroInput);
        }
        return Ok((amount_x, amount_y, lp_val));
    }

    if reserve_x == 0 || reserve_y == 0 {
        return Err(AmmError::ZeroInput);
    }

    // Calculate optimal amounts using BigUint
    // BL-H2 fix: LP tokens always round DOWN (floor division) to prevent rounding exploitation.
    // The user receives fewer LP tokens than the exact proportional amount, protecting the pool.
    let lp_from_x = to_big(amount_x) * to_big(total_lp) / to_big(reserve_x);
    let lp_from_y = to_big(amount_y) * to_big(total_lp) / to_big(reserve_y);

    // BL-H2: Use the minimum LP to ensure user doesn't get more LP than they deserve
    let lp_minted = if lp_from_x <= lp_from_y {
        lp_from_x.clone()
    } else {
        lp_from_y.clone()
    };

    // BL-H2: Reject if LP rounds to zero (dust deposit protection)
    if lp_minted == BigUint::from(0u32) {
        return Err(AmmError::ZeroInput);
    }

    // Calculate actual amounts consumed based on the LP minted (round UP to protect pool)
    // actual_x = lp_minted * reserve_x / total_lp (round up via ceil division)
    let total_lp_big = to_big(total_lp);
    let actual_x_big = (&lp_minted * to_big(reserve_x) + &total_lp_big - BigUint::from(1u32)) / &total_lp_big;
    let actual_y_big = (&lp_minted * to_big(reserve_y) + &total_lp_big - BigUint::from(1u32)) / &total_lp_big;

    let lp_val = from_big(&lp_minted).ok_or(AmmError::Overflow)?;
    let x_val = from_big(&actual_x_big).ok_or(AmmError::Overflow)?;
    let y_val = from_big(&actual_y_big).ok_or(AmmError::Overflow)?;

    // Ensure we don't consume more than what the user provided
    let final_x = x_val.min(amount_x);
    let final_y = y_val.min(amount_y);

    Ok((final_x, final_y, lp_val))
}

/// Calculate assets returned for burning LP tokens
/// Uses checked arithmetic (M-4 underflow prevention)
pub fn calculate_remove_liquidity(
    lp_amount: u128,
    reserve_x: u128,
    reserve_y: u128,
    total_lp: u128,
) -> Result<(u128, u128), AmmError> {
    if total_lp == 0 {
        return Err(AmmError::ZeroInput);
    }
    if lp_amount > total_lp {
        return Err(AmmError::InsufficientLiquidity);
    }

    // Use BigUint for safe multiplication
    let amount_x = to_big(lp_amount) * to_big(reserve_x) / to_big(total_lp);
    let amount_y = to_big(lp_amount) * to_big(reserve_y) / to_big(total_lp);

    let x_val = from_big(&amount_x).ok_or(AmmError::Overflow)?;
    let y_val = from_big(&amount_y).ok_or(AmmError::Overflow)?;

    // Verify no underflow would occur (M-4)
    if x_val > reserve_x || y_val > reserve_y {
        return Err(AmmError::InsufficientLiquidity);
    }

    Ok((x_val, y_val))
}

/// Maximum number of intents per batch to prevent unbounded batch size (M-8)
pub const MAX_BATCH_SIZE: usize = 50;

/// Minimum batch delay in milliseconds to prevent front-running (C-3)
pub const MIN_BATCH_DELAY_MS: u64 = 500;

/// Solve a batch of intents against pool state
///
/// SECURITY (C-3 anti-front-running):
/// - Intents are processed in FIFO order (by intent_id, which is DB auto-increment)
/// - All order timestamps are logged for auditability
/// - A minimum batch delay is enforced by the caller (manager.rs)
/// - Batch size is bounded to MAX_BATCH_SIZE to prevent unbounded processing
pub fn solve_batch(
    intents: &[(u64, ParsedIntent)],
    pair_info: &PairInfo,
) -> SolverResult {
    let mut result = SolverResult {
        swap_events: Vec::new(),
        mint_events: Vec::new(),
        burn_events: Vec::new(),
        refunded: Vec::new(),
        new_pair_info: pair_info.clone(),
    };

    // Enforce maximum batch size (M-8)
    let batch = if intents.len() > MAX_BATCH_SIZE {
        tracing::warn!(
            "Batch size {} exceeds MAX_BATCH_SIZE {}, truncating",
            intents.len(),
            MAX_BATCH_SIZE
        );
        &intents[..MAX_BATCH_SIZE]
    } else {
        intents
    };

    // SECURITY: Sort by intent_id (FIFO) for deterministic, auditable ordering (C-3)
    let mut sorted_intents: Vec<&(u64, ParsedIntent)> = batch.iter().collect();
    sorted_intents.sort_by_key(|(id, _)| *id);

    // Log all intent IDs and ordering for auditability (C-3)
    let intent_ids: Vec<u64> = sorted_intents.iter().map(|(id, _)| *id).collect();
    tracing::info!(
        "Processing batch of {} intents in FIFO order: {:?}",
        sorted_intents.len(),
        intent_ids
    );

    for (intent_id, intent) in sorted_intents {
        match process_single_intent(*intent_id, intent, &mut result.new_pair_info) {
            Ok(event) => match event {
                IntentEvent::Swap(e) => result.swap_events.push(e),
                IntentEvent::Mint(e) => result.mint_events.push(e),
                IntentEvent::Burn(e) => result.burn_events.push(e),
            },
            Err(reason) => {
                tracing::warn!("Intent {} refunded: {:?}", intent_id, reason);
                result.refunded.push(RefundedIntent {
                    intent_id: *intent_id,
                    reason,
                });
            }
        }
    }

    result
}

enum IntentEvent {
    Swap(SwapEvent),
    Mint(MintEvent),
    Burn(BurnEvent),
}

fn process_single_intent(
    intent_id: u64,
    intent: &ParsedIntent,
    pair: &mut PairInfo,
) -> Result<IntentEvent, IntentErrorReason> {
    match intent.intent_type {
        types::intent::IntentType::SwapExactInputForOutput => {
            let direction = intent.swap_type.ok_or(IntentErrorReason::EncodingInvalid)?;
            let (reserve_in, reserve_out) = match direction {
                SwapDirection::XToY => (pair.asset_x_reserve, pair.asset_y_reserve),
                SwapDirection::YToX => (pair.asset_y_reserve, pair.asset_x_reserve),
            };

            // SECURITY (H-1): Use checked AMM math that returns Result
            let amount_out = calculate_swap_exact_input(intent.amount_in, reserve_in, reserve_out, pair.fee_rate)
                .map_err(|_| IntentErrorReason::IntentNotFulfilled)?;

            // BL-M4 fix: Defense-in-depth — explicitly reject zero output even though
            // calculate_swap_exact_input already rejects it internally. This guards against
            // any future refactor that might remove the inner check.
            if amount_out == 0 {
                return Err(IntentErrorReason::IntentNotFulfilled);
            }

            if amount_out < intent.min_amount_out {
                return Err(IntentErrorReason::IntentNotFulfilled);
            }

            let fee_amount = intent.amount_in.checked_mul(pair.fee_rate as u128)
                .and_then(|v| v.checked_div(10000))
                .unwrap_or(0);

            // SECURITY (M-4): Use checked arithmetic for reserve updates
            match direction {
                SwapDirection::XToY => {
                    pair.asset_x_reserve = pair.asset_x_reserve.checked_add(intent.amount_in)
                        .ok_or(IntentErrorReason::IntentNotFulfilled)?;
                    pair.asset_y_reserve = pair.asset_y_reserve.checked_sub(amount_out)
                        .ok_or(IntentErrorReason::IntentNotFulfilled)?;
                }
                SwapDirection::YToX => {
                    pair.asset_y_reserve = pair.asset_y_reserve.checked_add(intent.amount_in)
                        .ok_or(IntentErrorReason::IntentNotFulfilled)?;
                    pair.asset_x_reserve = pair.asset_x_reserve.checked_sub(amount_out)
                        .ok_or(IntentErrorReason::IntentNotFulfilled)?;
                }
            }

            // BL-C1 fix: Use actual type_script args from intent metadata, NOT the type_hash
            Ok(IntentEvent::Swap(SwapEvent {
                intent_id,
                pool_type_hash: pair.pool_type_hash,
                direction,
                amount_in: intent.amount_in,
                amount_out,
                fee_amount,
                user_lock_script: intent.user_lock.clone(),
                output_token_type_script: CkbScript {
                    code_hash: intent.asset_y_type_hash,
                    hash_type: 1,
                    args: intent.asset_y_type_args.clone(), // BL-C1: use actual type script args
                },
                excess_input: 0,
                input_token_type_script: None,
            }))
        }

        types::intent::IntentType::SwapInputForExactOutput => {
            let direction = intent.swap_type.ok_or(IntentErrorReason::EncodingInvalid)?;
            let (reserve_in, reserve_out) = match direction {
                SwapDirection::XToY => (pair.asset_x_reserve, pair.asset_y_reserve),
                SwapDirection::YToX => (pair.asset_y_reserve, pair.asset_x_reserve),
            };

            // SECURITY (H-1): Use checked AMM math
            let required_in = calculate_swap_exact_output(
                intent.min_amount_out,
                reserve_in,
                reserve_out,
                pair.fee_rate,
            ).map_err(|_| IntentErrorReason::IntentNotFulfilled)?;

            if required_in > intent.amount_in {
                return Err(IntentErrorReason::IntentNotFulfilled);
            }

            let fee_amount = required_in.checked_mul(pair.fee_rate as u128)
                .and_then(|v| v.checked_div(10000))
                .unwrap_or(0);

            // SECURITY (M-4): Checked reserve updates
            match direction {
                SwapDirection::XToY => {
                    pair.asset_x_reserve = pair.asset_x_reserve.checked_add(required_in)
                        .ok_or(IntentErrorReason::IntentNotFulfilled)?;
                    pair.asset_y_reserve = pair.asset_y_reserve.checked_sub(intent.min_amount_out)
                        .ok_or(IntentErrorReason::IntentNotFulfilled)?;
                }
                SwapDirection::YToX => {
                    pair.asset_y_reserve = pair.asset_y_reserve.checked_add(required_in)
                        .ok_or(IntentErrorReason::IntentNotFulfilled)?;
                    pair.asset_x_reserve = pair.asset_x_reserve.checked_sub(intent.min_amount_out)
                        .ok_or(IntentErrorReason::IntentNotFulfilled)?;
                }
            }

            // BL-C3 fix: Track excess input for refund when required_in < user's amount_in
            let excess = intent.amount_in.saturating_sub(required_in);
            let refund_type_script = if excess > 0 {
                // Build refund type script for the INPUT token (asset_x for XToY, asset_y for YToX)
                let (refund_code_hash, refund_args) = match direction {
                    SwapDirection::XToY => (intent.asset_x_type_hash, intent.asset_x_type_args.clone()),
                    SwapDirection::YToX => (intent.asset_y_type_hash, intent.asset_y_type_args.clone()),
                };
                Some(CkbScript {
                    code_hash: refund_code_hash,
                    hash_type: 1,
                    args: refund_args, // BL-C1: use actual type script args
                })
            } else {
                None
            };

            Ok(IntentEvent::Swap(SwapEvent {
                intent_id,
                pool_type_hash: pair.pool_type_hash,
                direction,
                amount_in: required_in,
                amount_out: intent.min_amount_out,
                fee_amount,
                user_lock_script: intent.user_lock.clone(),
                output_token_type_script: CkbScript {
                    code_hash: intent.asset_y_type_hash,
                    hash_type: 1,
                    args: intent.asset_y_type_args.clone(), // BL-C1: use actual type script args
                },
                excess_input: excess,                       // BL-C3: excess to refund
                input_token_type_script: refund_type_script, // BL-C3: refund token type
            }))
        }

        types::intent::IntentType::AddLiquidity => {
            // intent.amount_in = asset_x amount, intent.min_amount_out = asset_y amount
            // SECURITY (H-1): Use checked AMM math
            let (actual_x, actual_y, lp_minted) = calculate_add_liquidity(
                intent.amount_in,
                intent.min_amount_out,
                pair.asset_x_reserve,
                pair.asset_y_reserve,
                pair.total_lp_supply,
            ).map_err(|_| IntentErrorReason::InvalidAddLiquidityIntent)?;

            // SECURITY (M-4): Checked reserve updates
            pair.asset_x_reserve = pair.asset_x_reserve.checked_add(actual_x)
                .ok_or(IntentErrorReason::InvalidAddLiquidityIntent)?;
            pair.asset_y_reserve = pair.asset_y_reserve.checked_add(actual_y)
                .ok_or(IntentErrorReason::InvalidAddLiquidityIntent)?;
            pair.total_lp_supply = pair.total_lp_supply.checked_add(lp_minted)
                .ok_or(IntentErrorReason::InvalidAddLiquidityIntent)?;

            Ok(IntentEvent::Mint(MintEvent {
                intent_id,
                pool_type_hash: pair.pool_type_hash,
                asset_x_amount: actual_x,
                asset_y_amount: actual_y,
                lp_amount: lp_minted,
                user_lock_script: intent.user_lock.clone(),
                lp_token_type_script: CkbScript {
                    code_hash: pair.pool_type_hash,
                    hash_type: 1,
                    args: pair.lp_type_args.clone(), // BL-C2: use actual LP token type script args from pool
                },
            }))
        }

        types::intent::IntentType::RemoveLiquidity => {
            // SECURITY (H-1, M-4): Use checked AMM math with underflow protection
            let (amount_x, amount_y) = calculate_remove_liquidity(
                intent.amount_in,
                pair.asset_x_reserve,
                pair.asset_y_reserve,
                pair.total_lp_supply,
            ).map_err(|_| IntentErrorReason::InvalidRemoveLiquidityIntent)?;

            // SECURITY (M-4): Checked subtraction to prevent underflow
            pair.asset_x_reserve = pair.asset_x_reserve.checked_sub(amount_x)
                .ok_or(IntentErrorReason::InvalidRemoveLiquidityIntent)?;
            pair.asset_y_reserve = pair.asset_y_reserve.checked_sub(amount_y)
                .ok_or(IntentErrorReason::InvalidRemoveLiquidityIntent)?;
            pair.total_lp_supply = pair.total_lp_supply.checked_sub(intent.amount_in)
                .ok_or(IntentErrorReason::InvalidRemoveLiquidityIntent)?;

            Ok(IntentEvent::Burn(BurnEvent {
                intent_id,
                pool_type_hash: pair.pool_type_hash,
                lp_amount: intent.amount_in,
                asset_x_amount: amount_x,
                asset_y_amount: amount_y,
                user_lock_script: intent.user_lock.clone(),
                asset_x_type_script: CkbScript {
                    code_hash: intent.asset_x_type_hash,
                    hash_type: 1,
                    args: intent.asset_x_type_args.clone(), // BL-C2: use actual type script args
                },
                asset_y_type_script: CkbScript {
                    code_hash: intent.asset_y_type_hash,
                    hash_type: 1,
                    args: intent.asset_y_type_args.clone(), // BL-C2: use actual type script args
                },
            }))
        }
    }
}

// BL-L1 fix: Removed unused integer_sqrt function.
// The codebase uses BigUint::sqrt() (via product.sqrt() in calculate_add_liquidity) instead.

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_swap_exact_input() {
        // Pool: 1000 X, 1000 Y, fee = 0.3%
        let out = calculate_swap_exact_input(100, 1000, 1000, 30).unwrap();
        // Expected: ~90.66 (with fee)
        assert!(out > 0 && out < 100);
        assert_eq!(out, 90); // floor division
    }

    #[test]
    fn test_swap_exact_input_zero_output_rejected() {
        // BL-H1: 1-wei swap against large pool should be rejected (output rounds to 0)
        let result = calculate_swap_exact_input(1, 1_000_000_000_000_000_000, 1_000_000_000_000_000_000, 30);
        assert!(result.is_err(), "Zero-output swap should be rejected");
    }

    #[test]
    fn test_swap_exact_input_zero() {
        assert!(calculate_swap_exact_input(0, 1000, 1000, 30).is_err());
        assert!(calculate_swap_exact_input(100, 0, 1000, 30).is_err());
    }

    #[test]
    fn test_swap_exact_output() {
        let input = calculate_swap_exact_output(90, 1000, 1000, 30).unwrap();
        // Should need ~100 input to get 90 output
        assert!(input > 90 && input < 120);
    }

    #[test]
    fn test_swap_exact_output_exceeds_reserve() {
        assert!(calculate_swap_exact_output(1000, 1000, 1000, 30).is_err());
    }

    #[test]
    fn test_add_liquidity_initial() {
        let (x, y, lp) = calculate_add_liquidity(1000, 1000, 0, 0, 0).unwrap();
        assert_eq!(x, 1000);
        assert_eq!(y, 1000);
        assert_eq!(lp, 1000); // sqrt(1000 * 1000) = 1000
    }

    #[test]
    fn test_add_liquidity_zero() {
        assert!(calculate_add_liquidity(0, 1000, 0, 0, 0).is_err());
    }

    #[test]
    fn test_remove_liquidity() {
        let (x, y) = calculate_remove_liquidity(500, 1000, 2000, 1000).unwrap();
        assert_eq!(x, 500);
        assert_eq!(y, 1000);
    }

    #[test]
    fn test_remove_liquidity_exceeds_supply() {
        assert!(calculate_remove_liquidity(1001, 1000, 2000, 1000).is_err());
    }

    #[test]
    fn test_large_values_no_overflow() {
        // Test with large u128 values that would overflow with raw multiplication
        let large = u128::MAX / 2;
        let result = calculate_swap_exact_input(large, large, large, 30);
        assert!(result.is_ok());
    }
}
