use ethers::types::U256;

/// Estimate gas for batch submission.
/// Uses configurable multiplier for safety margin.
/// `gas_multiplier` is a percentage (e.g., 120 = 1.2x safety margin).
pub fn estimate_batch_gas(payment_count: usize, gas_multiplier: u64) -> U256 {
    // Base: 100k + 30k per payment in batch
    let raw = U256::from(100_000 + 30_000 * payment_count);
    // Apply safety multiplier
    let multiplier = if gas_multiplier > 0 { gas_multiplier } else { 120 };
    raw * U256::from(multiplier) / U256::from(100u64)
}

/// Calculate nonce with gap protection.
/// Validates that the pending count is reasonable to avoid nonce gaps.
pub fn safe_nonce(current_nonce: U256, pending_count: u64) -> Option<U256> {
    // Sanity check: don't allow more than 16 pending transactions
    // to prevent nonce gaps from causing stuck transactions
    if pending_count > 16 {
        tracing::warn!(
            "Too many pending transactions ({}), possible nonce gap",
            pending_count
        );
        return None;
    }
    Some(current_nonce + U256::from(pending_count))
}
