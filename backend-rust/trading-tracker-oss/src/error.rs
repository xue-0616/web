//! Error types.
//!
//! The closed-source binary had `DexautoTrackerError` with messages:
//! * `"Error processing Instruction {0}"`
//! * `"unknown trade instruction"`
//! * `"Unknown Error: {0}"`
//! and a `From<DexautoTrackerError>` impl for `jsonrpsee_types::ErrorObject<'static>`.

use jsonrpsee::types::{ErrorObject, ErrorObjectOwned};
use thiserror::Error;

/// All fatal / recoverable errors that bubble up through the runner.
/// Error codes follow a JSON-RPC-friendly convention:
///   -32600..-32603 : JSON-RPC reserved range (passed through).
///   -33000..-33099 : Trading-tracker custom errors (see below).
#[derive(Debug, Error)]
pub enum DexautoTrackerError {
    #[error("Error processing Instruction {0}")]
    InstructionProcessing(usize),

    #[error("unknown trade instruction")]
    UnknownInstruction,

    #[error("pool {0} already tracked")]
    PoolAlreadyTracked(String),

    #[error("pool {0} not tracked")]
    PoolNotTracked(String),

    #[error("substreams stream error: {0}")]
    Substreams(String),

    #[error("solana RPC error: {0}")]
    SolanaRpc(String),

    #[error("config error: {0}")]
    Config(#[from] crate::config::ConfigError),

    #[error("database error: {0}")]
    Database(String),

    #[error("deserialization error: {0}")]
    Deserialize(String),

    #[error("Unknown Error: {0}")]
    Unknown(String),
}

impl DexautoTrackerError {
    /// JSON-RPC error code for this variant.
    pub const fn rpc_code(&self) -> i32 {
        match self {
            Self::InstructionProcessing(_) => -33_001,
            Self::UnknownInstruction => -33_002,
            Self::PoolAlreadyTracked(_) => -33_010,
            Self::PoolNotTracked(_) => -33_011,
            Self::Substreams(_) => -33_020,
            Self::SolanaRpc(_) => -33_021,
            Self::Config(_) => -33_030,
            Self::Database(_) => -33_031,
            Self::Deserialize(_) => -33_040,
            Self::Unknown(_) => -33_099,
        }
    }
}

impl From<DexautoTrackerError> for ErrorObjectOwned {
    fn from(e: DexautoTrackerError) -> Self {
        ErrorObject::owned(e.rpc_code(), e.to_string(), None::<()>)
    }
}

/// Convenience alias used across the crate.
pub type Result<T, E = DexautoTrackerError> = std::result::Result<T, E>;
