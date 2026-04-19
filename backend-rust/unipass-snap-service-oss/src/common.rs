//! Shared enums + small helper types.
//!
//! Enum values recovered from the ELF's `@desc` / `@values` column
//! comments (see `migrations/20240101000001_initial.sql`).
//!
//! We store these as `u8` in the MySQL column (`TINYINT UNSIGNED`) and
//! convert in/out of the Rust enum at the DAO layer — sqlx's `Type`
//! derive for `#[repr(u8)]` enums interacts poorly with `snake_case`
//! serde renaming when the column type is an integer, so the simpler
//! pattern is: raw u8 in the row struct, `TryFrom<u8>` at access time.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[repr(u8)]
pub enum ProviderType {
    /// MetaMask Snap — provider_identifier = Snap-derived EVM address.
    Snap = 0,
    /// Google OpenID Connect — provider_identifier = OIDC `sub` claim.
    Google = 1,
}

impl TryFrom<u8> for ProviderType {
    type Error = u8;
    fn try_from(v: u8) -> Result<Self, u8> {
        match v {
            0 => Ok(Self::Snap),
            1 => Ok(Self::Google),
            other => Err(other),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[repr(u8)]
pub enum GuideStatus {
    NotStart = 0,
    Finish = 1,
}

impl TryFrom<u8> for GuideStatus {
    type Error = u8;
    fn try_from(v: u8) -> Result<Self, u8> {
        match v {
            0 => Ok(Self::NotStart),
            1 => Ok(Self::Finish),
            other => Err(other),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[repr(u8)]
pub enum TxStatus {
    Init = 0,
    SignedFreeSig = 1,
    OnChain = 2,
    Failed = 3,
}

impl TryFrom<u8> for TxStatus {
    type Error = u8;
    fn try_from(v: u8) -> Result<Self, u8> {
        match v {
            0 => Ok(Self::Init),
            1 => Ok(Self::SignedFreeSig),
            2 => Ok(Self::OnChain),
            3 => Ok(Self::Failed),
            other => Err(other),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_type_roundtrip() {
        for p in [ProviderType::Snap, ProviderType::Google] {
            let j = serde_json::to_string(&p).unwrap();
            let back: ProviderType = serde_json::from_str(&j).unwrap();
            assert_eq!(p, back);
        }
    }

    #[test]
    fn provider_type_from_u8() {
        assert_eq!(ProviderType::try_from(0u8), Ok(ProviderType::Snap));
        assert_eq!(ProviderType::try_from(1u8), Ok(ProviderType::Google));
        assert_eq!(ProviderType::try_from(99u8), Err(99u8));
    }

    #[test]
    fn guide_status_from_u8() {
        assert_eq!(GuideStatus::try_from(0u8), Ok(GuideStatus::NotStart));
        assert_eq!(GuideStatus::try_from(1u8), Ok(GuideStatus::Finish));
        assert!(GuideStatus::try_from(2u8).is_err());
    }

    #[test]
    fn tx_status_from_u8() {
        assert_eq!(TxStatus::try_from(0u8), Ok(TxStatus::Init));
        assert_eq!(TxStatus::try_from(3u8), Ok(TxStatus::Failed));
        assert!(TxStatus::try_from(4u8).is_err());
    }

    #[test]
    fn tx_status_json_is_snake_case() {
        assert_eq!(serde_json::to_string(&TxStatus::SignedFreeSig).unwrap(), "\"signed_free_sig\"");
        assert_eq!(serde_json::to_string(&TxStatus::OnChain).unwrap(), "\"on_chain\"");
        assert_eq!(serde_json::to_string(&TxStatus::Init).unwrap(), "\"init\"");
    }
}
