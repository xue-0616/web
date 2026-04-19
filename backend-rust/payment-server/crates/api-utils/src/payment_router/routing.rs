use anyhow::Result;

/// Fee routing — calculate fees for different payment routes
pub struct FeeCalculation {
    pub base_fee_bps: u64,
    pub network_fee: u64,
    pub total_fee: u64,
}

/// Calculate fee for a payment route (MED-01 fix: use u128 to prevent overflow)
pub fn calculate_fee(route: &super::router::PaymentRoute, amount: u64) -> FeeCalculation {
    let base_fee_bps: u64 = match route {
        super::router::PaymentRoute::AlchemyPay => 150,   // 1.5%
        super::router::PaymentRoute::PayPal => 200,        // 2%
        super::router::PaymentRoute::Bitrefill => 0,       // no extra fee
        super::router::PaymentRoute::Coins => 100,         // 1%
        super::router::PaymentRoute::Wind => 100,          // 1%
        super::router::PaymentRoute::Bridge => 50,         // 0.5%
    };

    // MED-01 fix: Use u128 arithmetic to prevent overflow for large token amounts
    // With 18-decimal tokens, amounts can exceed u64::MAX/base_fee_bps
    let base_fee = ((amount as u128) * (base_fee_bps as u128) / 10000u128) as u64;

    // MED-02 note: Network fee should ideally come from gas estimation.
    // Using a reasonable default that covers basic L2 gas costs.
    let network_fee: u64 = 5000;

    FeeCalculation {
        base_fee_bps,
        network_fee,
        total_fee: base_fee.saturating_add(network_fee),
    }
}
