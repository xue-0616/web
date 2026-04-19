use anyhow::Result;
use super::common::PRECISION_FACTOR;

/// Build CKB transaction from solved farming intents
///
/// `new_total_staked` — the updated total_staked after all intents in this batch.
/// `current_time`     — the block timestamp used for this batch.
/// `pool_end_time`    — pool's configured end_time (to cap reward accrual).
pub fn build_farm_transaction(
    _pool_cell: &[u8],
    _intent_cells: &[Vec<u8>],
    _solver_results: &[u8],
    new_total_staked: Option<u128>,
    current_time: Option<u64>,
    pool_end_time: Option<u64>,
) -> Result<Vec<u8>> {
    // Construct CKB transaction for farm intent batch:
    // Uses molecule (flatbuffers-like) format for CKB Transaction
    //
    // Farm cell data layout:
    //   total_staked: u128 (16 bytes LE)
    //   reward_per_second: u128 (16 bytes LE)
    //   acc_reward_per_share: u128 (16 bytes LE)
    //   last_reward_time: u64 (8 bytes LE)
    //
    // For deposit: total_staked += amount, update acc_reward_per_share
    // For withdraw: total_staked -= amount, send LP tokens back
    // For harvest: calculate pending rewards, send reward tokens

    let mut outputs_data = Vec::new();
    // Parse current farm state from pool_cell data
    if _pool_cell.len() >= 56 {
        let total_staked = u128::from_le_bytes(_pool_cell[0..16].try_into().unwrap_or([0u8; 16]));
        let reward_per_second = u128::from_le_bytes(_pool_cell[16..32].try_into().unwrap_or([0u8; 16]));
        let mut acc_reward_per_share = u128::from_le_bytes(_pool_cell[32..48].try_into().unwrap_or([0u8; 16]));
        let last_reward_time = u64::from_le_bytes(_pool_cell[48..56].try_into().unwrap_or([0u8; 8]));

        // --- BUG-24 FIX: Update acc_reward_per_share and last_reward_time ---
        let mut updated_last_reward_time = last_reward_time;

        if let Some(now) = current_time {
            // Cap at pool_end_time to prevent rewards past expiry
            let effective_now = match pool_end_time {
                Some(end) => std::cmp::min(now, end),
                None => now,
            };

            if effective_now > last_reward_time && total_staked > 0 {
                let duration = (effective_now - last_reward_time) as u128;
                let reward = duration * reward_per_second;
                acc_reward_per_share += reward * PRECISION_FACTOR / total_staked;
                updated_last_reward_time = effective_now;
            }
        }

        // Use the batch-updated total_staked if provided
        let final_total_staked = new_total_staked.unwrap_or(total_staked);

        // Write UPDATED farm cell data into the output
        outputs_data.extend_from_slice(&final_total_staked.to_le_bytes());
        outputs_data.extend_from_slice(&reward_per_second.to_le_bytes());
        outputs_data.extend_from_slice(&acc_reward_per_share.to_le_bytes());     // UPDATED
        outputs_data.extend_from_slice(&updated_last_reward_time.to_le_bytes()); // UPDATED
    }
    // 1. Collect input cells (pool cell + intent cells)
    // 2. Build output cells (updated pool + user LP cells + reward cells)
    // 3. Serialize with molecule
    // 4. Return unsigned transaction bytes
    Ok(outputs_data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_state_updated_in_output() {
        // total_staked=1000, reward_per_second=10, acc=0, last_time=100
        let mut pool_cell = Vec::new();
        pool_cell.extend_from_slice(&1000u128.to_le_bytes());
        pool_cell.extend_from_slice(&10u128.to_le_bytes());
        pool_cell.extend_from_slice(&0u128.to_le_bytes());
        pool_cell.extend_from_slice(&100u64.to_le_bytes());

        let result = build_farm_transaction(
            &pool_cell,
            &[],
            &[],
            Some(1200u128),  // new total after deposits
            Some(200u64),    // current_time
            Some(10000u64),  // pool_end_time
        ).unwrap();

        assert_eq!(result.len(), 56);
        // total_staked should be updated
        let ts = u128::from_le_bytes(result[0..16].try_into().unwrap());
        assert_eq!(ts, 1200);
        // acc_reward_per_share should be non-zero
        let acc = u128::from_le_bytes(result[32..48].try_into().unwrap());
        // 100 seconds * 10 rps * 1e12 / 1000 = 1_000_000_000_000
        assert_eq!(acc, 1_000_000_000_000);
        // last_reward_time should be 200
        let lrt = u64::from_le_bytes(result[48..56].try_into().unwrap());
        assert_eq!(lrt, 200);
    }
}
