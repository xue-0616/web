use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Pool list query parameters
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetPoolsRequest {
    /// Search keyword (token symbol/name)
    #[serde(default)]
    pub search_key: Option<String>,
    /// Filter by pool type hashes (comma-separated hex)
    #[serde(default)]
    pub pool_type_hashes: Option<String>,
    /// Order by field
    #[serde(default = "default_order_by")]
    pub order_by: String,
    /// Page number (1-indexed)
    #[serde(default = "default_page_no")]
    pub page_no: u64,
    /// Page size
    #[serde(default = "default_page_size")]
    pub page_size: u64,
}

fn default_order_by() -> String {
    "tvl".to_string()
}
fn default_page_no() -> u64 {
    1
}
fn default_page_size() -> u64 {
    20
}

/// Pool info in API response
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PoolInfoResponse {
    pub id: u64,
    pub pool_type_hash: String,
    pub asset_x_type_hash: String,
    pub asset_y_type_hash: String,
    pub asset_x: TokenAsset,
    pub asset_y: TokenAsset,
    pub lp_symbol: String,
    pub fee_rate: String,
    pub tvl: Option<String>,
    pub day_volume: Option<String>,
    pub total_volume: Option<String>,
    pub day_apr: Option<String>,
    pub asset_x_amount: Option<String>,
    pub asset_y_amount: Option<String>,
    pub based_asset: Option<String>,
    pub day_txs_count: Option<u64>,
    pub total_txs_count: Option<u64>,
}

/// Token asset info embedded in pool response
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TokenAsset {
    pub type_hash: String,
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub logo: Option<String>,
}

/// Pool info request by token pair
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PoolInfoRequest {
    pub asset_x_type_hash: String,
    pub asset_y_type_hash: String,
}

/// Create pool request
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePoolRequest {
    /// Signed CKB transaction hex
    pub tx: String,
}

/// Pool status response
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PoolStatusResponse {
    pub status: String,
    pub pool_type_hash: String,
    pub asset_x_reserve: String,
    pub asset_y_reserve: String,
    pub total_lp_supply: String,
    pub fee_rate: String,
    pub is_miner_chain: bool,
}

/// Transaction list request
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetTransactionsRequest {
    /// Asset X type hash (hex)
    pub asset_x_type_hash: Option<String>,
    /// Asset Y type hash (hex)
    pub asset_y_type_hash: Option<String>,
    /// Address (CKB address string)
    pub address: Option<String>,
    /// Intent type filter
    pub intent_type: Option<String>,
    /// Page number
    #[serde(default = "default_page_no")]
    pub page_no: u64,
    /// Page size
    #[serde(default = "default_page_size")]
    pub page_size: u64,
}

/// Transaction in response
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransactionResponse {
    pub tx_hash: String,
    pub pool_type_hash: String,
    pub intent_type: String,
    pub amount_in: String,
    pub amount_out: String,
    pub status: String,
    pub created_at: String,
}

/// Candlestick data request
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CandlestickRequest {
    pub pool_type_hash: String,
    /// Candlestick type: "1h", "4h", "1d", "1w"
    pub candlestick_type: String,
    /// Start time (ISO 8601)
    pub start_time: Option<String>,
    /// End time (ISO 8601)
    pub end_time: Option<String>,
}

/// Candlestick data point
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CandlestickData {
    pub open: String,
    pub high: String,
    pub low: String,
    pub close: String,
    pub volume: String,
    pub timestamp: String,
}

/// Chain info response
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChainsInfo {
    pub ckb_fee_rate: u64,
    pub based_token_price: String,
}

/// Token query
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TokensRequest {
    /// Search query (symbol/name)
    pub query: Option<String>,
}

/// Token response
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    pub type_hash: String,
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub logo: Option<String>,
    pub price: Option<String>,
}

/// Top tokens response
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TopTokensResponse {
    pub based_tokens: Vec<TokenResponse>,
    pub popular_tokens: Vec<TokenResponse>,
}

/// Login request
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub address: String,
    #[serde(default)]
    pub bound_address: Option<String>,
    pub sign_timestamp: u64,
    pub signature: String,
    #[serde(default)]
    pub joy_id_msg: Option<String>,
    #[serde(default)]
    pub pubkey: Option<String>,
    pub wallet_type: String,
}

/// Login response with JWT
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub token: String,
    pub account_id: u64,
}
