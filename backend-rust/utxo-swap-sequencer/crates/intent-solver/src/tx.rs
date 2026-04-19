use types::intent::{Cell, CellDep, CkbScript, OutPoint, PairInfo, SwapEvent, MintEvent, BurnEvent};
use crate::SolverResult;

/// Build a CKB transaction from solver result
///
/// Transaction structure:
/// Inputs:
///   - Pool cell (contains current reserves)
///   - Intent cells (one per intent in batch)
///   - Fee cell (sequencer's cell for tx fee)
///
/// Outputs:
///   - Updated pool cell (new reserves)
///   - User output cells (swap results / LP tokens / returned assets)
///   - Change cells (refunds for partial fills)
///   - Fee cell change
///
/// Cell deps:
///   - Sequencer lock script dep
///   - Pool type script dep
///   - Configs cell dep
///   - Deployment cell dep
pub fn build_batch_transaction(
    solver_result: &SolverResult,
    pool_cell: &Cell,
    intent_cells: &[Cell],
    fee_cell: &Cell,
    sequencer_lock: &CkbScript,
    cell_deps: &[CellDep],
) -> Result<CkbTransaction, TxBuildError> {
    let mut inputs = Vec::new();
    let mut outputs = Vec::new();
    let mut outputs_data = Vec::new();
    let mut witnesses = Vec::new();

    // 1. Pool cell as first input
    inputs.push(pool_cell.out_point.clone());

    // 2. Intent cells as remaining inputs
    for cell in intent_cells {
        inputs.push(cell.out_point.clone());
    }

    // 3. Fee cell as last input
    inputs.push(fee_cell.out_point.clone());

    // 4. Updated pool cell as first output
    let new_pool_data = encode_pair_data(&solver_result.new_pair_info);
    outputs.push(CellOutput {
        capacity: pool_cell.capacity,
        lock: sequencer_lock.clone(),
        type_script: pool_cell.type_script.clone(),
    });
    outputs_data.push(new_pool_data);

    // 5. Swap result outputs
    for event in &solver_result.swap_events {
        // Return swapped tokens to user
        let (output, data) = build_swap_output(event, intent_cells);
        outputs.push(output);
        outputs_data.push(data);

        // BL-C3 fix: Add refund cell for excess input tokens (exact-output swaps)
        if event.excess_input > 0 {
            if let Some(ref refund_type) = event.input_token_type_script {
                let refund_amount_le = event.excess_input.to_le_bytes();
                outputs.push(CellOutput {
                    capacity: 14200000000, // 142 CKB (UDT cell minimum)
                    lock: event.user_lock_script.clone(),
                    type_script: Some(refund_type.clone()),
                });
                outputs_data.push(refund_amount_le.to_vec());
            }
        }
    }

    // 6. Mint result outputs (LP tokens to user)
    for event in &solver_result.mint_events {
        let (output, data) = build_mint_output(event, intent_cells);
        outputs.push(output);
        outputs_data.push(data);
    }

    // 7. Burn result outputs (returned assets to user)
    for event in &solver_result.burn_events {
        let (output_x, data_x, output_y, data_y) = build_burn_outputs(event, intent_cells);
        outputs.push(output_x);
        outputs_data.push(data_x);
        outputs.push(output_y);
        outputs_data.push(data_y);
    }

    // 8. Refund outputs
    // SECURITY (M-3): Build a mapping from intent_id to cell index by collecting ALL
    // intent IDs (from swaps, mints, burns, refunds) and sorting them by intent_id
    // to match the FIFO order used by the solver (which is also the order of intent_cells).
    let intent_id_to_cell_idx: std::collections::HashMap<u64, usize> = {
        // Collect all intent IDs from all event types in FIFO order (sorted by intent_id).
        // The solver processes intents sorted by intent_id, and intent_cells are passed
        // in the same FIFO order, so sorting all IDs gives us the correct cell index mapping.
        let mut all_ids: Vec<u64> = Vec::new();
        for event in &solver_result.swap_events {
            all_ids.push(event.intent_id);
        }
        for event in &solver_result.mint_events {
            all_ids.push(event.intent_id);
        }
        for event in &solver_result.burn_events {
            all_ids.push(event.intent_id);
        }
        for refund in &solver_result.refunded {
            all_ids.push(refund.intent_id);
        }
        // Sort by intent_id to match the FIFO ordering of intent_cells
        all_ids.sort();
        all_ids
            .into_iter()
            .enumerate()
            .map(|(idx, id)| (id, idx))
            .collect()
    };

    for refund in &solver_result.refunded {
        // Return original cell to user unchanged
        if let Some(&cell_idx) = intent_id_to_cell_idx.get(&refund.intent_id) {
            if let Some(cell) = intent_cells.get(cell_idx) {
                outputs.push(CellOutput {
                    capacity: cell.capacity,
                    lock: cell.lock.clone(),
                    type_script: cell.type_script.clone(),
                });
                outputs_data.push(cell.data.clone());
            } else {
                tracing::error!(
                    "Refund: cell index {} out of bounds for intent_id {}",
                    cell_idx,
                    refund.intent_id
                );
            }
        } else {
            tracing::error!(
                "Refund: no cell mapping found for intent_id {}",
                refund.intent_id
            );
        }
    }

    // 9. Fee cell change
    let total_fee = calculate_tx_fee(inputs.len(), outputs.len());
    if fee_cell.capacity > total_fee + 6100000000 {
        // minimum cell capacity
        outputs.push(CellOutput {
            capacity: fee_cell.capacity - total_fee,
            lock: sequencer_lock.clone(),
            type_script: None,
        });
        outputs_data.push(Vec::new());
    }

    // 10. BL-M6 fix: Verify CKB capacity conservation before finalizing.
    // Total input capacity must be >= total output capacity to ensure no CKB is created
    // out of thin air. The difference (input - output) is the implicit transaction fee.
    let total_input_capacity: u64 = pool_cell.capacity
        .saturating_add(intent_cells.iter().map(|c| c.capacity).sum::<u64>())
        .saturating_add(fee_cell.capacity);
    let total_output_capacity: u64 = outputs.iter().map(|o| o.capacity).sum();

    if total_input_capacity < total_output_capacity {
        return Err(TxBuildError::InsufficientFee);
    }

    // 11. Witness placeholder for sequencer signature
    witnesses.push(vec![0u8; 85]); // WitnessArgs with placeholder signature

    Ok(CkbTransaction {
        inputs,
        outputs,
        outputs_data,
        witnesses,
        cell_deps: cell_deps.to_vec(),
    })
}

/// Encode pair info into CKB cell data
fn encode_pair_data(pair: &PairInfo) -> Vec<u8> {
    let mut data = Vec::new();
    data.extend_from_slice(&pair.asset_x_reserve.to_le_bytes());
    data.extend_from_slice(&pair.asset_y_reserve.to_le_bytes());
    data.extend_from_slice(&pair.total_lp_supply.to_le_bytes());
    data.extend_from_slice(&pair.fee_rate.to_le_bytes());
    data
}

fn build_swap_output(event: &SwapEvent, _intent_cells: &[Cell]) -> (CellOutput, Vec<u8>) {
    // Build UDT output cell for the user with swapped token amount
    // Cell: capacity(min 142 CKB) + type_script(UDT) + lock_script(user) + data(u128 LE amount)
    let udt_amount_le = event.amount_out.to_le_bytes();
    (
        CellOutput {
            capacity: 14200000000, // 142 CKB (UDT cell minimum)
            lock: event.user_lock_script.clone(),
            type_script: Some(event.output_token_type_script.clone()),
        },
        udt_amount_le.to_vec(),
    )
}

fn build_mint_output(event: &MintEvent, _intent_cells: &[Cell]) -> (CellOutput, Vec<u8>) {
    // Build LP token output cell for the user
    // LP token is a UDT representing pool share
    let lp_amount_le = event.lp_amount.to_le_bytes();
    (
        CellOutput {
            capacity: 14200000000,
            lock: event.user_lock_script.clone(),
            type_script: Some(event.lp_token_type_script.clone()),
        },
        lp_amount_le.to_vec(),
    )
}

fn build_burn_outputs(
    event: &BurnEvent,
    _intent_cells: &[Cell],
) -> (CellOutput, Vec<u8>, CellOutput, Vec<u8>) {
    // Build two output cells returning both assets to the user
    let x_amount_le = event.asset_x_amount.to_le_bytes();
    let y_amount_le = event.asset_y_amount.to_le_bytes();
    let output_x = CellOutput {
        capacity: 14200000000,
        lock: event.user_lock_script.clone(),
        type_script: Some(event.asset_x_type_script.clone()),
    };
    let output_y = CellOutput {
        capacity: 14200000000,
        lock: event.user_lock_script.clone(),
        type_script: Some(event.asset_y_type_script.clone()),
    };
    (output_x, x_amount_le.to_vec(), output_y, y_amount_le.to_vec())
}

/// Estimate transaction fee based on size
fn calculate_tx_fee(input_count: usize, output_count: usize) -> u64 {
    // CKB fee = tx_size * fee_rate / 1000
    // Estimate: ~100 bytes per input, ~80 bytes per output, ~500 bytes overhead
    let estimated_size = input_count * 100 + output_count * 80 + 500;
    let fee_rate = 1000u64; // 1000 shannons per KB
    (estimated_size as u64 * fee_rate + 999) / 1000
}

#[derive(Debug, Clone)]
pub struct CellOutput {
    pub capacity: u64,
    pub lock: CkbScript,
    pub type_script: Option<CkbScript>,
}

#[derive(Debug)]
pub struct CkbTransaction {
    pub inputs: Vec<OutPoint>,
    pub outputs: Vec<CellOutput>,
    pub outputs_data: Vec<Vec<u8>>,
    pub witnesses: Vec<Vec<u8>>,
    pub cell_deps: Vec<CellDep>,
}

#[derive(Debug, thiserror::Error)]
pub enum TxBuildError {
    #[error("Insufficient fee cell capacity")]
    InsufficientFee,
    #[error("No intents to process")]
    EmptyBatch,
    #[error("Pool cell not found")]
    PoolCellNotFound,
}
