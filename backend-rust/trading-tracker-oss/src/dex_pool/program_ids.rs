//! Solana DEX program ID constants + classifier.
//!
//! The substreams `.spkg` (TopLedger `solana-dex-trades-extended`) surfaces
//! both the *outer* program and the *inner* program for every decoded trade.
//! We classify those program IDs into `DexKind` variants so the runner can
//! route the trade to the correct pricing policy.
//!
//! Sources (mainnet, verified against Solscan):
//!   * Raydium AMM v4 (OpenBook):  675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
//!   * Raydium CLMM:               CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK
//!   * Raydium CPMM:               CPMMoo8UTaGX8L3FPMgKDd7NJAhDgi26tuUJk6hP7jT (v0.9)
//!                                 CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW (v1.0)
//!   * Pump.fun:                   6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
//!
//! NOTE: the CPMM program ID shipped in multiple iterations; we accept both
//! the 0.9 and 1.0 deploys. Add more as new deploys ship.

use super::DexKind;

pub const RAYDIUM_AMM_V4: &str = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
pub const RAYDIUM_CLMM: &str = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
pub const RAYDIUM_CPMM_V09: &str = "CPMMoo8UTaGX8L3FPMgKDd7NJAhDgi26tuUJk6hP7jT";
pub const RAYDIUM_CPMM_V10: &str = "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW";
pub const PUMP_FUN: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

/// Classify a `TradeData` by its `outer_program` / `inner_program` fields.
///
/// Priority: prefer `inner_program` when it exists (it identifies the actual
/// swapping program, e.g. when a router like Jupiter wraps the swap), falling
/// back to `outer_program`.
pub fn classify(outer_program: &str, inner_program: &str) -> Option<DexKind> {
    // The substreams package emits "" for inner_program when the swap wasn't
    // nested. Use outer in that case.
    let candidates: [&str; 2] = if inner_program.is_empty() {
        [outer_program, outer_program]
    } else {
        [inner_program, outer_program]
    };
    for p in candidates {
        match p {
            RAYDIUM_AMM_V4 => return Some(DexKind::RaydiumAmm),
            RAYDIUM_CLMM => return Some(DexKind::RaydiumClmm),
            RAYDIUM_CPMM_V09 | RAYDIUM_CPMM_V10 => return Some(DexKind::RaydiumCpmm),
            PUMP_FUN => return Some(DexKind::Pump),
            _ => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_raydium_amm_outer() {
        assert_eq!(classify(RAYDIUM_AMM_V4, ""), Some(DexKind::RaydiumAmm));
    }

    #[test]
    fn classifies_pump_inner_wins_over_outer_router() {
        // Typical Jupiter-routed pump trade: outer is Jupiter (unknown), inner is pump.
        assert_eq!(classify("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", PUMP_FUN), Some(DexKind::Pump));
    }

    #[test]
    fn unknown_program_returns_none() {
        assert_eq!(classify("UnknownProgram11111111111111111111111111111", ""), None);
    }

    #[test]
    fn cpmm_both_deploys_recognised() {
        assert_eq!(classify(RAYDIUM_CPMM_V09, ""), Some(DexKind::RaydiumCpmm));
        assert_eq!(classify(RAYDIUM_CPMM_V10, ""), Some(DexKind::RaydiumCpmm));
    }
}
