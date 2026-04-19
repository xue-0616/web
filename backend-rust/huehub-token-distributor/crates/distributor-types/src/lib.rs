pub mod chain;

use serde::{Deserialize, Serialize};
use std::fmt;

// ===========================================================================
// Status enums — prevent typo bugs from free-form String status fields
// ===========================================================================

/// Status of a distribution transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DistributorTxStatus {
    Pending,
    Submitted,
    Confirmed,
    Failed,
}

impl DistributorTxStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "Pending",
            Self::Submitted => "Submitted",
            Self::Confirmed => "Confirmed",
            Self::Failed => "Failed",
        }
    }

    pub fn from_str_safe(s: &str) -> Option<Self> {
        match s {
            "Pending" => Some(Self::Pending),
            "Submitted" => Some(Self::Submitted),
            "Confirmed" => Some(Self::Confirmed),
            "Failed" => Some(Self::Failed),
            _ => None,
        }
    }
}

impl fmt::Display for DistributorTxStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Status of a mint transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MintTxStatus {
    Pending,
    Submitted,
    Confirmed,
    Failed,
}

impl MintTxStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "Pending",
            Self::Submitted => "Submitted",
            Self::Confirmed => "Confirmed",
            Self::Failed => "Failed",
        }
    }
}

impl fmt::Display for MintTxStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

// ===========================================================================
// Safe amount handling — overflow-safe u128 parsing for token amounts
// ===========================================================================

/// Parse a decimal string into u128 (token amounts can be large with 18 decimals).
/// Returns None if the string is invalid, negative, or overflows u128.
pub fn parse_token_amount(s: &str) -> Option<u128> {
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed.starts_with('-') {
        return None;
    }
    trimmed.parse::<u128>().ok()
}

/// Safely subtract `sub` from `base`, returning None on underflow.
pub fn checked_sub_amount(base: u128, sub: u128) -> Option<u128> {
    base.checked_sub(sub)
}

/// Validate that a CKB address has a reasonable format (non-empty, starts with expected prefix).
pub fn validate_ckb_address(addr: &str) -> bool {
    let trimmed = addr.trim();
    // CKB mainnet addresses start with "ckb1", testnet with "ckt1"
    !trimmed.is_empty()
        && (trimmed.starts_with("ckb1") || trimmed.starts_with("ckt1"))
        && trimmed.len() >= 46
        && trimmed.chars().all(|c| c.is_ascii_alphanumeric())
}

/// Maximum number of retry attempts for a stuck/failed distribution.
pub const MAX_DISTRIBUTION_RETRIES: u32 = 5;

/// Maximum age (in seconds) for a "Submitted" tx before it's considered stuck.
pub const SUBMITTED_TX_TIMEOUT_SECS: i64 = 600; // 10 minutes
