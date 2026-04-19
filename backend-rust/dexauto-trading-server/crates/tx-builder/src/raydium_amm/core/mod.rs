pub mod math;

/// Raydium AMM constant-product pool state
#[derive(Debug, Clone)]
pub struct AmmPoolState {
    pub pool_coin_amount: u64,
    pub pool_pc_amount: u64,
    pub swap_fee_numerator: u64,
    pub swap_fee_denominator: u64,
}
