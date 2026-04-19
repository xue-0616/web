use anyhow::Result;
use types::intent::{ParsedIntent, PairInfo, SwapEvent, RefundedIntent, IntentErrorReason, SwapDirection};

/// Build a batch CKB transaction that processes multiple intents against a pool
///
/// Steps:
/// 1. Fetch current pool cell from indexer
/// 2. Validate all intents against pool reserves
/// 3. Calculate swap outputs using constant product formula
/// 4. Build CKB transaction with:
///    - Pool cell as input (with updated reserves as output)
///    - Intent cells as inputs (consumed)
///    - User output cells (swap results)
///    - Sequencer change cell
///    - Cell deps (lock scripts, type scripts, configs)
/// 5. Sign with sequencer private key

pub struct BatchTxResult {
    pub tx_bytes: Vec<u8>,
    pub tx_hash: [u8; 32],
    pub swap_events: Vec<SwapEvent>,
    pub refunded_intents: Vec<RefundedIntent>,
    pub processed_intent_ids: Vec<u64>,
}

/// Build batch transaction for swap intents
pub fn build_batch_swap_tx(
    pool_info: &PairInfo,
    intents: &[(u64, ParsedIntent)],
    sequencer_lock_args: &[u8],
) -> Result<BatchTxResult> {
    let mut current_x = pool_info.asset_x_reserve;
    let mut current_y = pool_info.asset_y_reserve;
    let mut swap_events = Vec::new();
    let mut refunded = Vec::new();
    let mut processed_ids = Vec::new();

    for (intent_id, intent) in intents {
        let result = match intent.swap_type {
            Some(SwapDirection::XToY) => {
                calculate_swap(current_x, current_y, intent.amount_in, pool_info.fee_rate)
            }
            Some(SwapDirection::YToX) => {
                calculate_swap(current_y, current_x, intent.amount_in, pool_info.fee_rate)
            }
            _ => {
                refunded.push(RefundedIntent {
                    intent_id: *intent_id,
                    reason: IntentErrorReason::EncodingInvalid,
                });
                continue;
            }
        };

        match result {
            Ok((amount_out, fee)) => {
                if amount_out < intent.min_amount_out {
                    refunded.push(RefundedIntent {
                        intent_id: *intent_id,
                        reason: IntentErrorReason::IntentNotFulfilled,
                    });
                    continue;
                }

                // BL-H1 fix: Reject zero-output swaps
                if amount_out == 0 {
                    refunded.push(RefundedIntent {
                        intent_id: *intent_id,
                        reason: IntentErrorReason::IntentNotFulfilled,
                    });
                    continue;
                }

                // BL-H5 fix: Per-intent error handling for reserve updates.
                // If a single intent causes overflow, skip it instead of failing the entire batch.
                let reserve_update = match intent.swap_type.unwrap() {
                    SwapDirection::XToY => {
                        current_x.checked_add(intent.amount_in)
                            .and_then(|new_x| current_y.checked_sub(amount_out).map(|new_y| (new_x, new_y)))
                    }
                    SwapDirection::YToX => {
                        current_y.checked_add(intent.amount_in)
                            .and_then(|new_y| current_x.checked_sub(amount_out).map(|new_x| (new_x, new_y)))
                    }
                };

                match reserve_update {
                    Some((new_x, new_y)) => {
                        current_x = new_x;
                        current_y = new_y;
                    }
                    None => {
                        // BL-H5: Skip this intent instead of failing entire batch
                        tracing::warn!(
                            "BL-H5: Intent {} caused reserve overflow/underflow, skipping",
                            intent_id
                        );
                        refunded.push(RefundedIntent {
                            intent_id: *intent_id,
                            reason: IntentErrorReason::IntentNotFulfilled,
                        });
                        continue;
                    }
                }

                swap_events.push(SwapEvent {
                    intent_id: *intent_id,
                    pool_type_hash: pool_info.pool_type_hash,
                    direction: intent.swap_type.unwrap(),
                    amount_in: intent.amount_in,
                    amount_out,
                    fee_amount: fee,
                    user_lock_script: intent.user_lock.clone(),
                    output_token_type_script: types::intent::CkbScript {
                        code_hash: intent.asset_y_type_hash,
                        hash_type: 1,
                        args: intent.asset_y_type_args.clone(), // BL-C1: use actual type script args
                    },
                    excess_input: 0,
                    input_token_type_script: None,
                });
                processed_ids.push(*intent_id);
            }
            Err(_) => {
                refunded.push(RefundedIntent {
                    intent_id: *intent_id,
                    reason: IntentErrorReason::IntentNotFulfilled,
                });
            }
        }
    }

    // Build CKB transaction skeleton
    let tx_bytes = build_ckb_tx_skeleton(
        pool_info,
        current_x,
        current_y,
        &swap_events,
        &refunded,
        sequencer_lock_args,
    )?;

    // Compute tx hash (blake2b of serialized tx without witnesses)
    let tx_hash = compute_tx_hash(&tx_bytes);

    Ok(BatchTxResult {
        tx_bytes,
        tx_hash,
        swap_events,
        refunded_intents: refunded,
        processed_intent_ids: processed_ids,
    })
}

/// Constant product AMM swap calculation — UNIFIED with solver (H-2)
/// Uses the same formula as intent_solver::calculate_swap_exact_input to prevent divergence.
/// Formula: amount_out = (amount_in * (10000 - fee_rate) * reserve_out) / (reserve_in * 10000 + amount_in * (10000 - fee_rate))
/// Returns (amount_out, fee_amount)
///
/// SECURITY (H-1): Uses checked arithmetic via BigUint to prevent overflow
fn calculate_swap(
    reserve_in: u128,
    reserve_out: u128,
    amount_in: u128,
    fee_rate_bps: u64,
) -> Result<(u128, u128)> {
    use num_bigint::BigUint;

    if reserve_in == 0 || reserve_out == 0 || amount_in == 0 {
        anyhow::bail!("Zero reserve or amount");
    }

    // Use BigUint to prevent overflow (H-1)
    let amount_in_big = BigUint::from(amount_in);
    let reserve_in_big = BigUint::from(reserve_in);
    let reserve_out_big = BigUint::from(reserve_out);
    let fee_complement = BigUint::from(10000u64.saturating_sub(fee_rate_bps));
    let base = BigUint::from(10000u64);

    // Unified formula (H-2): same as intent_solver
    let fee_adjusted = &amount_in_big * &fee_complement;
    let numerator = &fee_adjusted * &reserve_out_big;
    let denominator = &reserve_in_big * &base + &fee_adjusted;

    if denominator == BigUint::from(0u32) {
        anyhow::bail!("Division by zero in swap calculation");
    }

    let amount_out_big = &numerator / &denominator;

    // BL-H1 fix: Reject zero-output swaps (defense-in-depth against 1-wei attacks)
    if amount_out_big == BigUint::from(0u32) {
        anyhow::bail!("Swap output is zero — amount too small");
    }

    // Convert back to u128
    let amount_out_bytes = amount_out_big.to_bytes_le();
    if amount_out_bytes.len() > 16 {
        anyhow::bail!("Swap result overflow");
    }
    let mut arr = [0u8; 16];
    arr[..amount_out_bytes.len()].copy_from_slice(&amount_out_bytes);
    let amount_out = u128::from_le_bytes(arr);

    if amount_out >= reserve_out {
        anyhow::bail!("Insufficient liquidity");
    }

    // Fee calculation with checked arithmetic
    let fee = amount_in.checked_mul(fee_rate_bps as u128)
        .and_then(|v| v.checked_div(10000))
        .unwrap_or(0);

    Ok((amount_out, fee))
}

fn build_ckb_tx_skeleton(
    _pool_info: &PairInfo,
    _new_reserve_x: u128,
    _new_reserve_y: u128,
    _swap_events: &[SwapEvent],
    _refunded: &[RefundedIntent],
    _sequencer_lock_args: &[u8],
) -> Result<Vec<u8>> {
    // Molecule serialization of CKB Transaction
    // In production, this uses the ckb-types crate
    // For now, build a minimal valid transaction skeleton
    let mut tx = Vec::new();

    // Version (4 bytes LE)
    tx.extend_from_slice(&0u32.to_le_bytes());

    // Placeholder: full transaction building requires:
    // 1. Cell deps (deployment cells, configs, lock scripts)
    // 2. Header deps (if needed)
    // 3. Inputs (pool cell + intent cells)
    // 4. Outputs (new pool cell + user cells + change cell)
    // 5. Outputs data (pool reserves + UDT amounts)
    // 6. Witnesses (sequencer signature)
    //
    // Each field is molecule-encoded (length-prefixed vector)
    // Full implementation requires CKB SDK / molecule codegen

    Ok(tx)
}

fn compute_tx_hash(tx_bytes: &[u8]) -> [u8; 32] {
    use blake2b_rs::Blake2bBuilder;
    let mut hasher = Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    hasher.update(tx_bytes);
    let mut result = [0u8; 32];
    hasher.finalize(&mut result);
    result
}
