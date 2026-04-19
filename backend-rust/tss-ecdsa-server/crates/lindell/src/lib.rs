pub mod sign;

/// Lindell 2017 Two-Party ECDSA — Party1 (server) library.
///
/// Reference: <https://github.com/ZenGo-X/multi-party-ecdsa>
///
/// Protocol flow:
/// KeyGen (§4.1):
///   Phase 1: Party1 → commitment to Q1
///   Phase 2: Party2 → DLogProof ; Party1 → decommit Q1, Paillier setup, correct-key proof
///   Phase 3: Party1 → PDL with slack proof
///
/// Sign (§5):
///   Phase 1: Party1 → ephemeral R1 + EC-DDH proof
///   Phase 2: Party2 → committed R2, decommit, partial sig ; Party1 → verify, final ECDSA sig

#[derive(Debug, thiserror::Error)]
pub enum TssError {
    #[error("Incorrect proof — verification of a zero-knowledge proof failed")]
    IncorrectProof,
    #[error("Key generation error: {0}")]
    KeyGenError(String),
    #[error("{0}")]
    SpecificError(String),
    #[error("Serialization: {0}")]
    SerdeJsonError(String),
}
