//! Pump.fun bonding-curve account layout.
//!
//! Confirmed via Ghidra: the closed-source binary has
//! `<BondingCurve as anchor_lang::AccountDeserialize>::try_deserialize` —
//! which means the account is Anchor-serialized (8-byte discriminator +
//! borsh-encoded fields). We reproduce the same wire format using `borsh`
//! directly, which avoids pulling in `anchor-lang → solana-program 1.16 →
//! curve25519-dalek 3.x → zeroize<1.4`, a chain that otherwise conflicts
//! with our modern `tonic 0.11 → rustls 0.22 → zeroize ^1.6` stack.

use borsh::{BorshDeserialize, BorshSerialize};

use crate::error::DexautoTrackerError;

pub mod accounts {
    use super::*;

    /// 8-byte Anchor account discriminator for `BondingCurve`. Known constant
    /// from the open-source Pump.fun IDL (`pump-fun/pump-fun-program`).
    pub const BONDING_CURVE_DISCRIMINATOR: [u8; 8] = [23, 183, 248, 55, 96, 216, 172, 96];

    /// The Pump.fun bonding-curve state account.
    ///
    /// All fields are little-endian per borsh's integer encoding. Field order
    /// matches the on-chain program source.
    #[derive(Debug, Clone, BorshSerialize, BorshDeserialize)]
    pub struct BondingCurve {
        pub virtual_token_reserves: u64,
        pub virtual_sol_reserves: u64,
        pub real_token_reserves: u64,
        pub real_sol_reserves: u64,
        pub token_total_supply: u64,
        pub complete: bool,
    }

    impl BondingCurve {
        /// Parse the 8-byte discriminator + borsh payload from a raw Solana
        /// account's data field. Matches the semantics of the closed-source
        /// `<BondingCurve as AccountDeserialize>::try_deserialize` function.
        pub fn try_deserialize(data: &[u8]) -> Result<Self, DexautoTrackerError> {
            if data.len() < 8 {
                return Err(DexautoTrackerError::Deserialize(
                    "BondingCurve: buffer shorter than 8-byte discriminator".into(),
                ));
            }
            if data[..8] != BONDING_CURVE_DISCRIMINATOR {
                return Err(DexautoTrackerError::Deserialize(
                    "BondingCurve: discriminator mismatch".into(),
                ));
            }
            Self::try_deserialize_unchecked(data)
        }

        /// Same as `try_deserialize` but skips the discriminator check —
        /// mirrors the binary's `try_deserialize_unchecked` export.
        pub fn try_deserialize_unchecked(data: &[u8]) -> Result<Self, DexautoTrackerError> {
            borsh::from_slice::<BondingCurve>(&data[8..]).map_err(|e| {
                DexautoTrackerError::Deserialize(format!("BondingCurve: {e}"))
            })
        }

        /// Spot price (SOL per token) implied by current virtual reserves,
        /// i.e. the constant-product pricing the Pump.fun program uses before
        /// bonding-curve completion.
        pub fn spot_price_sol_per_token(&self) -> f64 {
            if self.virtual_token_reserves == 0 {
                return 0.0;
            }
            self.virtual_sol_reserves as f64 / self.virtual_token_reserves as f64
        }
    }
}
