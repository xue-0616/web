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

// ===========================================================================
// Tests — these gate the three pure validators used on every hot-path
// distribution / mint call in main.rs (process_single_distribution,
// process_single_mint, mark_tx_failed refund path). A regression in
// any of them would either leak money (too-lax validation) or DoS the
// queue (too-strict validation), so each failure class gets its own
// #[test].
// ===========================================================================
#[cfg(test)]
mod tests {
    use super::*;

    // --- parse_token_amount -----------------------------------------------

    #[test]
    fn parses_zero_and_valid_integers() {
        assert_eq!(parse_token_amount("0"), Some(0));
        assert_eq!(parse_token_amount("1"), Some(1));
        assert_eq!(parse_token_amount("1000000000000000000"), Some(1_000_000_000_000_000_000));
    }

    #[test]
    fn parses_u128_max() {
        // u128::MAX is 340282366920938463463374607431768211455 — key
        // check because 18-decimal tokens can legitimately approach
        // this range for high-supply pools.
        let max_str = u128::MAX.to_string();
        assert_eq!(parse_token_amount(&max_str), Some(u128::MAX));
    }

    #[test]
    fn rejects_overflow_above_u128_max() {
        // One past u128::MAX must round-trip to None, not silently
        // truncate — otherwise distribution accounting is corrupt.
        let overflow = format!("{}0", u128::MAX);
        assert_eq!(parse_token_amount(&overflow), None);
    }

    #[test]
    fn rejects_empty_and_whitespace_only() {
        assert_eq!(parse_token_amount(""), None);
        assert_eq!(parse_token_amount("   "), None);
    }

    #[test]
    fn trims_surrounding_whitespace() {
        // CSV imports and front-end copy-paste are notorious for
        // these, so trim() in the impl is load-bearing.
        assert_eq!(parse_token_amount("  42  "), Some(42));
        assert_eq!(parse_token_amount("\t100\n"), Some(100));
    }

    #[test]
    fn rejects_negative_numbers() {
        // u128 parsing would implicitly reject negatives, but the
        // early-check also guards against exotic Unicode minus signs
        // that might slip past locale-specific clients.
        assert_eq!(parse_token_amount("-1"), None);
        assert_eq!(parse_token_amount("-0"), None);
    }

    #[test]
    fn rejects_non_numeric() {
        assert_eq!(parse_token_amount("abc"), None);
        assert_eq!(parse_token_amount("1.0"), None);      // no decimals — token amounts are integer shannons
        assert_eq!(parse_token_amount("1e18"), None);    // no scientific notation
        assert_eq!(parse_token_amount("0x10"), None);    // no hex
        assert_eq!(parse_token_amount("1,000"), None);   // no thousands separators
    }

    // --- checked_sub_amount -----------------------------------------------

    #[test]
    fn checked_sub_happy_paths() {
        assert_eq!(checked_sub_amount(10, 3), Some(7));
        assert_eq!(checked_sub_amount(100, 100), Some(0));
        assert_eq!(checked_sub_amount(u128::MAX, 1), Some(u128::MAX - 1));
    }

    #[test]
    fn checked_sub_detects_underflow() {
        // The critical case: if this ever returns Some(_), a tx
        // deducts more than the distributor_token remaining balance
        // and the pool goes negative.
        assert_eq!(checked_sub_amount(5, 10), None);
        assert_eq!(checked_sub_amount(0, 1), None);
    }

    // --- validate_ckb_address ---------------------------------------------

    #[test]
    fn accepts_well_formed_mainnet_and_testnet_addresses() {
        // 46 chars is the minimum length the validator accepts; real
        // short-form ckb1 addresses are longer but this pins the floor.
        let mainnet = format!("ckb1{}", "q".repeat(42));
        let testnet = format!("ckt1{}", "q".repeat(42));
        assert!(validate_ckb_address(&mainnet));
        assert!(validate_ckb_address(&testnet));
    }

    #[test]
    fn rejects_wrong_prefix() {
        // Only ckb1 and ckt1 are valid. Anything else — including
        // typosquatted prefixes — must fail closed.
        assert!(!validate_ckb_address(&format!("ckc1{}", "q".repeat(42))));
        assert!(!validate_ckb_address(&format!("eth1{}", "q".repeat(42))));
        assert!(!validate_ckb_address(&format!("CKB1{}", "q".repeat(42))));
    }

    #[test]
    fn rejects_too_short() {
        // 45 chars = 4 prefix + 41 body — one below the 46-byte floor.
        let short = format!("ckb1{}", "q".repeat(41));
        assert_eq!(short.len(), 45);
        assert!(!validate_ckb_address(&short));
    }

    #[test]
    fn rejects_non_alphanumeric_chars() {
        // Bech32 bodies are all lowercase alphanumeric; any other
        // character (spaces, hyphens, slashes) is an injection attempt
        // or a truncation artifact.
        let addr = format!("ckb1{}--", "q".repeat(40));
        assert_eq!(addr.len(), 46);
        assert!(!validate_ckb_address(&addr));
        let addr2 = format!("ckb1 {}", "q".repeat(41));
        assert!(!validate_ckb_address(&addr2));
    }

    #[test]
    fn rejects_empty_and_whitespace() {
        assert!(!validate_ckb_address(""));
        assert!(!validate_ckb_address("   "));
    }

    #[test]
    fn trims_surrounding_whitespace_before_checking() {
        // Same rationale as parse_token_amount: front-end / DB CSV
        // imports leak whitespace. Must accept a surrounded-by-space
        // address if the core is valid.
        let addr = format!("  ckb1{}  ", "q".repeat(42));
        assert!(validate_ckb_address(&addr));
    }

    // --- DistributorTxStatus round-trip -----------------------------------

    #[test]
    fn status_str_roundtrip() {
        for s in [
            DistributorTxStatus::Pending,
            DistributorTxStatus::Submitted,
            DistributorTxStatus::Confirmed,
            DistributorTxStatus::Failed,
        ] {
            assert_eq!(DistributorTxStatus::from_str_safe(s.as_str()), Some(s));
        }
    }

    #[test]
    fn status_rejects_unknown_and_empty() {
        // The DB stores status as a free-form String; the parser
        // must reject every non-canonical value so a stray
        // migration or manual UPDATE can't break invariants.
        assert_eq!(DistributorTxStatus::from_str_safe(""), None);
        assert_eq!(DistributorTxStatus::from_str_safe("pending"), None); // case-sensitive
        assert_eq!(DistributorTxStatus::from_str_safe("PENDING"), None);
        assert_eq!(DistributorTxStatus::from_str_safe("Unknown"), None);
    }
}
