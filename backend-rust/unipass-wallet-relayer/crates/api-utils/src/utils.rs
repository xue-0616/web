/// Relayer utility functions

/// Calculate L1 data fee for Arbitrum transactions
pub fn estimate_arb_l1_data_fee(calldata: &[u8]) -> u64 {
    // Rough estimate: 16 gas per non-zero byte, 4 per zero byte
    let mut gas: u64 = 0;
    for &b in calldata {
        gas += if b == 0 { 4 } else { 16 };
    }
    gas * 20 // multiply by L1 gas price estimate
}

/// Check if chain uses EIP-1559
pub fn is_eip1559_chain(chain_id: u64) -> bool {
    matches!(chain_id, 1 | 42161 | 137)
}
