pub mod checker;
pub mod parser;

use serde::{Deserialize, Serialize};

/// CKB Script representation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CkbScript {
    pub code_hash: [u8; 32],
    pub hash_type: u8,
    pub args: Vec<u8>,
}

/// CKB Cell OutPoint
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OutPoint {
    pub tx_hash: [u8; 32],
    pub index: u32,
}

/// CKB Cell
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub out_point: OutPoint,
    pub capacity: u64,
    pub lock: CkbScript,
    pub type_script: Option<CkbScript>,
    pub data: Vec<u8>,
}

/// CKB Cell Dependency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellDep {
    pub out_point: OutPoint,
    pub dep_type: u8, // 0=code, 1=dep_group
}

/// Pair Info — AMM pool on-chain state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairInfo {
    pub pool_type_hash: [u8; 32],
    pub asset_x_reserve: u128,
    pub asset_y_reserve: u128,
    pub total_lp_supply: u128,
    pub fee_rate: u64, // basis points, e.g. 30 = 0.3%
    /// BL-C2 fix: Actual type_script args for the LP token (from pool on-chain type_script)
    pub lp_type_args: Vec<u8>,
}

/// Parsed Intent from CKB cell data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedIntent {
    pub intent_type: IntentType,
    pub pool_type_hash: [u8; 32],
    pub asset_x_type_hash: [u8; 32],
    pub asset_y_type_hash: [u8; 32],
    /// BL-C1 fix: Actual type_script args for asset_x (from on-chain type_script, NOT the type_hash)
    pub asset_x_type_args: Vec<u8>,
    /// BL-C1 fix: Actual type_script args for asset_y (from on-chain type_script, NOT the type_hash)
    pub asset_y_type_args: Vec<u8>,
    pub swap_type: Option<SwapDirection>,
    pub amount_in: u128,
    pub min_amount_out: u128,
    pub user_lock: CkbScript,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IntentType {
    SwapExactInputForOutput,
    SwapInputForExactOutput,
    AddLiquidity,
    RemoveLiquidity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SwapDirection {
    XToY,
    YToX,
}

/// Swap event emitted after processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapEvent {
    pub intent_id: u64,
    pub pool_type_hash: [u8; 32],
    pub direction: SwapDirection,
    pub amount_in: u128,
    pub amount_out: u128,
    pub fee_amount: u128,
    pub user_lock_script: CkbScript,
    pub output_token_type_script: CkbScript,
    /// BL-C3 fix: Excess input tokens to refund (for exact-output swaps where required_in < user_input)
    pub excess_input: u128,
    /// BL-C3 fix: Type script for input token refund cell (needed when excess_input > 0)
    pub input_token_type_script: Option<CkbScript>,
}

/// Mint event (add liquidity)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MintEvent {
    pub intent_id: u64,
    pub pool_type_hash: [u8; 32],
    pub asset_x_amount: u128,
    pub asset_y_amount: u128,
    pub lp_amount: u128,
    pub user_lock_script: CkbScript,
    pub lp_token_type_script: CkbScript,
}

/// Burn event (remove liquidity)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BurnEvent {
    pub intent_id: u64,
    pub pool_type_hash: [u8; 32],
    pub lp_amount: u128,
    pub asset_x_amount: u128,
    pub asset_y_amount: u128,
    pub user_lock_script: CkbScript,
    pub asset_x_type_script: CkbScript,
    pub asset_y_type_script: CkbScript,
}

/// Refunded intent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefundedIntent {
    pub intent_id: u64,
    pub reason: IntentErrorReason,
}

/// Intent error reason
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IntentErrorReason {
    EncodingInvalid,
    BatchInvalid,
    UdtCellAssetTypeHashUnmatch,
    LiquidityTypeHashUnmatch,
    ConfigsCellNotFound,
    DeploymentCellNotFound,
    InvalidIntentUnlock,
    InvalidAddLiquidityIntent,
    InvalidRemoveLiquidityIntent,
    SequencerLockRequired,
    SequencerProxyLockRequired,
    InvalidOutputPairInfo,
    InvalidAssetOutput,
    InvalidCreatePairFeeRateNotAllowed,
    CellCountNotMatch,
    LiquidityAmountNotMatch,
    AssetXAmountNotMatch,
    AssetYAmountNotMatch,
    IntentNotFulfilled,
    InvalidPairAssetHash,
    InvalidLiquidityAmount,
    InvalidTypeID,
    CellNumTypeIDNotMatch,
}
