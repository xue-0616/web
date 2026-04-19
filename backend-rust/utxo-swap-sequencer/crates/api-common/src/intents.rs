use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Request to submit a swap intent (exact input for output)
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendIntentTxRequest {
    /// Signed CKB transaction hex
    pub tx: String,
}

/// Response after submitting an intent
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendIntentTxResult {
    /// Intent transaction hash
    pub tx_hash: String,
    /// Intent status
    pub status: String,
}

/// Request to get intent status
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetIntentTxRequest {
    /// Intent transaction hash (hex, 0x-prefixed)
    pub tx_hash: String,
}

/// Intent status response
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IntentStatusResponse {
    pub intent_id: u64,
    pub status: String,
    pub tx_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_tx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_reason: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
}

/// Claim task request
/// BL-L2 fix: Removed unused account_id field. The account_id is now extracted from
/// JWT claims in the handler (H-7 fix), so the request body field was redundant and
/// confusing for API consumers.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClaimTaskRequest {
    pub task_id: u64,
}
