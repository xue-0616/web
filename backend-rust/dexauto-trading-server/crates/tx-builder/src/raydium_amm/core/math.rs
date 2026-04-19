/// Raydium AMM constant-product math
/// Reference: https://github.com/raydium-io/raydium-amm

/// Calculate swap output for exact input (constant product)
/// out = (pool_out * amount_in * (fee_d - fee_n)) / (pool_in * fee_d + amount_in * (fee_d - fee_n))
pub fn calculate_swap_exact_in(
    amount_in: u64,
    pool_in: u64,
    pool_out: u64,
    fee_numerator: u64,
    fee_denominator: u64,
) -> u64 {
    let amount_in = amount_in as u128;
    let pool_in = pool_in as u128;
    let pool_out = pool_out as u128;
    let fee_n = fee_numerator as u128;
    let fee_d = fee_denominator as u128;

    let amount_in_with_fee = amount_in * (fee_d - fee_n);
    let numerator = pool_out * amount_in_with_fee;
    let denominator = pool_in * fee_d + amount_in_with_fee;

    if denominator == 0 { return 0; }
    (numerator / denominator) as u64
}

/// Calculate swap input for exact output.
/// in = (pool_in * amount_out * fee_d) / ((pool_out - amount_out) * (fee_d - fee_n)) + 1
///
/// Returns `u64::MAX` as a sentinel value when `amount_out >= pool_out` or when
/// the denominator is zero, indicating that the swap is not feasible.
/// **Callers MUST check for `u64::MAX` before using the result in a transaction.**
pub fn calculate_swap_exact_out(
    amount_out: u64,
    pool_in: u64,
    pool_out: u64,
    fee_numerator: u64,
    fee_denominator: u64,
) -> u64 {
    if amount_out >= pool_out { return u64::MAX; }

    let amount_out = amount_out as u128;
    let pool_in = pool_in as u128;
    let pool_out = pool_out as u128;
    let fee_n = fee_numerator as u128;
    let fee_d = fee_denominator as u128;

    let numerator = pool_in * amount_out * fee_d;
    let denominator = (pool_out - amount_out) * (fee_d - fee_n);

    if denominator == 0 { return u64::MAX; }
    (numerator / denominator + 1) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_in() {
        // 0.25% fee (25/10000)
        let out = calculate_swap_exact_in(1000, 100_000, 100_000, 25, 10000);
        assert!(out > 0 && out < 1000);
        // approx 990 with 0.25% fee on 1% of pool
    }

    #[test]
    fn test_exact_out() {
        let input = calculate_swap_exact_out(990, 100_000, 100_000, 25, 10000);
        assert!(input > 990);
    }
}
