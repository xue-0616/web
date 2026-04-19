use serde::{Deserialize, Serialize};

/// A fully validated bridge payment with all checks passed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatedPayment {
    pub payment_id: u64,
    pub source_chain_id: u64,
    pub dest_chain_id: u64,
    pub tx_hash: String,
    pub log_index: u32,
    pub sender: String,
    pub recipient: String,
    pub token: String,
    pub amount: String,
    pub signature: String,
    pub validated_at: chrono::DateTime<chrono::Utc>,
}

/// Validation request from the API layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRequest {
    pub source_chain_id: u64,
    pub dest_chain_id: u64,
    pub tx_hash: String,
    pub log_index: Option<u32>,
    pub amount: String,
    pub token_address: String,
    pub sender: String,
    pub recipient: String,
}

/// Detailed validation result with rejection reason and multisig status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub status: String,
    pub signature: Option<String>,
    /// All collected signatures when multisig threshold is met.
    pub all_signatures: Option<Vec<String>>,
    /// EIP-712 message hash (hex) for external validators to co-sign.
    pub msg_hash: Option<String>,
    /// Number of signatures collected so far.
    pub signatures_collected: u32,
    /// Threshold required for approval.
    pub threshold_required: u32,
    pub rejection_reason: Option<String>,
}

impl ValidationResult {
    pub fn rejected(reason: impl Into<String>) -> Self {
        Self {
            valid: false,
            status: "rejected".to_string(),
            signature: None,
            all_signatures: None,
            msg_hash: None,
            signatures_collected: 0,
            threshold_required: 0,
            rejection_reason: Some(reason.into()),
        }
    }

    pub fn approved(signature: String) -> Self {
        Self {
            valid: true,
            status: "approved".to_string(),
            signature: Some(signature),
            all_signatures: None,
            msg_hash: None,
            signatures_collected: 1,
            threshold_required: 1,
            rejection_reason: None,
        }
    }

    /// Threshold met — all required signatures collected.
    pub fn threshold_met(
        signature: String,
        all_sigs: Vec<String>,
        msg_hash: String,
        collected: u32,
        threshold: u32,
    ) -> Self {
        Self {
            valid: true,
            status: "approved".to_string(),
            signature: Some(signature),
            all_signatures: Some(all_sigs),
            msg_hash: Some(msg_hash),
            signatures_collected: collected,
            threshold_required: threshold,
            rejection_reason: None,
        }
    }

    /// Pending — this validator signed but threshold not yet met.
    pub fn pending_multisig(
        signature: String,
        msg_hash: String,
        collected: u32,
        threshold: u32,
    ) -> Self {
        Self {
            valid: true,
            status: "pending_multisig".to_string(),
            signature: Some(signature),
            all_signatures: None,
            msg_hash: Some(msg_hash),
            signatures_collected: collected,
            threshold_required: threshold,
            rejection_reason: None,
        }
    }
}

/// Error types for validation pipeline.
#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("Input validation failed: {0}")]
    InvalidInput(String),
    #[error("Chain {0} is not supported")]
    UnsupportedChain(u64),
    #[error("Token {0} is not whitelisted")]
    UnwhitelistedToken(String),
    #[error("Source transaction not found or not confirmed")]
    TxNotConfirmed,
    #[error("Insufficient block confirmations: have {have}, need {need}")]
    InsufficientConfirmations { have: u64, need: u64 },
    #[error("On-chain log verification failed: {0}")]
    LogVerificationFailed(String),
    #[error("Replay attack detected: message already processed")]
    ReplayDetected,
    #[error("Amount exceeds maximum transfer limit")]
    AmountExceedsLimit,
    #[error("RPC error: {0}")]
    RpcError(String),
    #[error("Internal error: {0}")]
    Internal(String),
}
