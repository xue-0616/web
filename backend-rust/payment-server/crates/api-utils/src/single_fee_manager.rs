use ethers::types::U256;

/// Single-chain fee manager — calculates gas costs and user fees.
/// FINDING-14: Uses integer arithmetic (U256) throughout — no f64 for financial math.
pub struct SingleFeeManager {
    chain_id: u64,
    /// Gas price in wei (integer, not floating-point gwei)
    gas_price_wei: U256,
    fee_markup_bps: u64,
}

impl SingleFeeManager {
    pub fn new(chain_id: u64) -> Self {
        // Default: 0.1 gwei = 100_000_000 wei (integer)
        Self {
            chain_id,
            gas_price_wei: U256::from(100_000_000u64),
            fee_markup_bps: 50,
        }
    }

    /// Update gas price using integer wei value
    pub fn update_gas_price_wei(&mut self, wei: U256) {
        self.gas_price_wei = wei;
    }

    /// Update gas price from gwei as u64 (integer gwei only)
    pub fn update_gas_price_gwei(&mut self, gwei: u64) {
        self.gas_price_wei = U256::from(gwei) * U256::from(1_000_000_000u64);
    }

    /// Estimate total fee in wei for a given gas limit.
    /// All arithmetic is done in U256 — no floating point.
    pub fn estimate_fee(&self, gas_limit: u64) -> U256 {
        let base_fee = U256::from(gas_limit) * self.gas_price_wei;
        let markup = base_fee * U256::from(self.fee_markup_bps) / U256::from(10000u64);
        base_fee + markup
    }
}
