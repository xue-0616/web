//! Raydium DEX account layouts.
//!
//! Raydium ships three distinct AMMs:
//!
//! * `RaydiumAmm`  — OpenBook-based v4 constant-product AMM.
//! * `RaydiumClmm` — Concentrated-liquidity AMM (Uniswap v3 style).
//! * `RaydiumCpmm` — Standard constant-product AMM (the newer program).
//!
//! Full parser implementations (decoding the pool state + trade instructions)
//! are deferred to Session 3. This module defines the trait surface that the
//! runner will use.

use solana_pubkey::Pubkey;

use crate::{dex_pool::DexKind, error::DexautoTrackerError};

/// Minimal compiled-instruction representation. This mirrors the shape of
/// `solana_sdk::instruction::CompiledInstruction` but avoids pulling in the
/// full `solana-sdk` dependency tree during Session 1. Session 3 will swap
/// this for the upstream type once the full dep resolver conflicts are
/// resolved.
#[derive(Debug, Clone)]
pub struct CompiledInstruction {
    pub program_id_index: u8,
    pub accounts: Vec<u8>,
    pub data: Vec<u8>,
}

/// Opaque handle to a parsed trade from on-chain instruction data.
#[derive(Debug, Clone)]
pub struct ParsedTrade {
    pub base_in: u64,
    pub base_out: u64,
    pub quote_in: u64,
    pub quote_out: u64,
    pub pool: Pubkey,
}

/// Trait implemented by each Raydium variant's parser. `accounts` is the
/// resolved list of per-ix account pubkeys (post-ALUT lookup).
pub trait RaydiumParser {
    fn kind() -> DexKind;
    fn parse_trade(
        ix: &CompiledInstruction,
        accounts: &[Pubkey],
    ) -> Result<Option<ParsedTrade>, DexautoTrackerError>;
}

// Concrete empty parsers live here — Session 3 fills them in.
pub struct AmmV4;
pub struct Clmm;
pub struct Cpmm;

impl RaydiumParser for AmmV4 {
    fn kind() -> DexKind {
        DexKind::RaydiumAmm
    }
    fn parse_trade(
        _ix: &CompiledInstruction,
        _accounts: &[Pubkey],
    ) -> Result<Option<ParsedTrade>, DexautoTrackerError> {
        // TODO(session-3): parse the AmmV4 `swap_base_in` / `swap_base_out`
        // instructions. Instruction discriminator is the 1st byte of `ix.data`.
        Ok(None)
    }
}

impl RaydiumParser for Clmm {
    fn kind() -> DexKind {
        DexKind::RaydiumClmm
    }
    fn parse_trade(
        _ix: &CompiledInstruction,
        _accounts: &[Pubkey],
    ) -> Result<Option<ParsedTrade>, DexautoTrackerError> {
        // TODO(session-3): parse CLMM `swap` / `swap_v2` / `swap_router_base_in` ixes.
        Ok(None)
    }
}

impl RaydiumParser for Cpmm {
    fn kind() -> DexKind {
        DexKind::RaydiumCpmm
    }
    fn parse_trade(
        _ix: &CompiledInstruction,
        _accounts: &[Pubkey],
    ) -> Result<Option<ParsedTrade>, DexautoTrackerError> {
        // TODO(session-3): parse CPMM `swap_base_input` / `swap_base_output` ixes.
        Ok(None)
    }
}
