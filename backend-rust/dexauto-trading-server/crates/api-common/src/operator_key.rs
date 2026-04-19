use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorKeyResponse {
    pub id: u64,
    pub trading_account_pda: String,
    pub max_priority_fee: i64,
    pub is_active: bool,
}

/// Request to create an operator key.
/// `max_priority_fee` uses `u64` to prevent negative values (Audit #20).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOpKeyRequest {
    pub user_id: String,
    pub max_priority_fee: u64,
}

/// Solana swap request (from binary struct)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SolanaSwapRequest {
    pub order_id: String,
    pub trading_account_pda: String,
    pub pool_id: Option<String>,
    pub input_mint: String,
    pub output_mint: String,
    pub amount_specified: u64,
    pub other_amount_threshold: u64,
    pub slippage_bps: u16,
    pub base_in: bool,
    pub fee_rate_bps: u16,
    pub max_priority_fee: u64,
    pub is_anti_mev: bool,
    pub bribery_amount: u64,
    pub swap_type: SwapType,
    pub trigger_price_usd: Option<f64>,
    /// Tier-weighted consensus score from Node side (S=3, A=2, B=1 per wallet).
    /// Drives signal-strength-aware Jito tip tier + retry policy in tx_submitter.
    /// Default 0 (=Low) preserves back-compat for callers that don't send it.
    #[serde(default)]
    pub consensus_votes: u32,
    /// Whether this order is a Buy or Sell — drives retry policy (sells escalate
    /// aggressively, buys don't chase after slippage). Defaults to false (Buy).
    #[serde(default)]
    pub is_sell: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SwapType {
    ExactIn,
    ExactOut,
}
