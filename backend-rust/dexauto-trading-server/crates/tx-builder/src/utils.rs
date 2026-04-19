use anyhow::Result;

/// Compute unit price for priority fees
pub fn compute_priority_fee(max_priority_fee: u64, is_anti_mev: bool) -> u64 {
    if is_anti_mev {
        // Use NextBlock/Jito for MEV protection, lower priority fee
        max_priority_fee / 2
    } else {
        max_priority_fee
    }
}

/// Estimate compute units for a transaction
pub fn estimate_compute_units(instruction_count: usize) -> u32 {
    // Base: 200k CU + 100k per instruction
    200_000 + (instruction_count as u32) * 100_000
}
