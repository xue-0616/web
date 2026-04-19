//! PLONK prover abstraction.
//!
//! # The real prover (NOT rewritten here)
//!
//! The closed-source ELF statically links:
//!   * `plonk` — the circuit description (~4MB of .rodata for the SRS)
//!   * `ark_poly`, `ark_ff`, `ark_ec`, `ark_poly_commit` — arkworks 0.3
//!   * a hand-written DKIM-verification circuit
//!
//! Extracting the circuit itself from a stripped binary is **not**
//! feasible. Upstream `UniPass-email-circuits` (Apache-2.0) contains an
//! equivalent circuit and CLI prover, but packaging it as a Rust
//! library with a stable ABI requires either (a) FFI through arkworks
//! or (b) spawning a subprocess and capturing stdout.
//!
//! # Our approach
//!
//! Expose a narrow [`Prover`] trait. This crate ships two impls:
//!
//!   * [`NoopProver`] — returns a deterministic "proof-shaped" string,
//!     used by the unit tests and in the CI image so that the wiring
//!     (API → Redis → scheduler → DB) is exercised end-to-end without
//!     pulling in the heavy SRS.
//!   * [`SubprocessProver`] — runs an external binary and parses its
//!     stdout (simple contract: the subprocess prints JSON matching
//!     [`ProofArtifact`]).
//!
//! Deployments that want the full closed-source-equivalent behaviour
//! wire in their own `impl Prover for MyArkworksProver { ... }` pointing
//! at upstream `UniPass-email-circuits`.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::types::{EmailType, ProveTask};

/// The set of values the PLONK prover emits per email. Column names
/// match the `EmailProofs` table (which holds one row per proof).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProofArtifact {
    pub header_hash: String,
    pub email_type: EmailType,
    pub from_left_index: i32,
    pub from_len: i32,
    pub success: bool,
    pub public_inputs_num: String,
    pub domain_size: String,
    pub header_pub_match: String,
    pub public_inputs: String,
    pub proof: String,
    pub failed_reason: String,
}

#[async_trait]
pub trait Prover: Send + Sync + 'static {
    async fn prove(&self, task: &ProveTask) -> Result<ProofArtifact, String>;
}

// ------------------------------------------------------------------
// NoopProver — used by tests and the scaffold CI.
// ------------------------------------------------------------------

/// A prover that emits a deterministic placeholder artifact.
///
/// **DO NOT USE IN PRODUCTION.** The artifact is NOT cryptographically
/// sound — it's a stable hash of the input, intended solely to exercise
/// downstream plumbing (DB storage, Redis ack, API retrieval).
#[derive(Debug, Default, Clone, Copy)]
pub struct NoopProver;

#[async_trait]
impl Prover for NoopProver {
    async fn prove(&self, task: &ProveTask) -> Result<ProofArtifact, String> {
        // Derive a tiny, deterministic surrogate. Using djb2 to avoid
        // a sha/keccak dep on the test path.
        let mut h: u64 = 5381;
        for b in task.email.bytes() {
            h = h.wrapping_mul(33).wrapping_add(b as u64);
        }
        let (public_inputs_num, domain_size) = match task.email_type {
            EmailType::OpenId => (1024, 1024),
            EmailType::Smtp => (2048, 2048),
        };
        // Reject intentionally-corrupt inputs so the "failed" stage is
        // reachable from tests without needing a real DKIM verifier.
        if task.email.starts_with("__BAD__") {
            return Ok(ProofArtifact {
                header_hash: task.header_hash.clone(),
                email_type: task.email_type,
                from_left_index: 0,
                from_len: 0,
                success: false,
                public_inputs_num: format!("0x{public_inputs_num:x}"),
                domain_size: format!("0x{domain_size:x}"),
                header_pub_match: String::new(),
                public_inputs: String::new(),
                proof: String::new(),
                failed_reason: "noop prover: corrupt input".into(),
            });
        }
        let proof_hex = format!("0x{h:016x}{h:016x}{h:016x}{h:016x}");
        Ok(ProofArtifact {
            header_hash: task.header_hash.clone(),
            email_type: task.email_type,
            from_left_index: 7, // "From: ".len() — deterministic marker
            from_len: task.email.split('\n').next().unwrap_or("").len() as i32,
            success: true,
            public_inputs_num: format!("0x{public_inputs_num:x}"),
            domain_size: format!("0x{domain_size:x}"),
            header_pub_match: format!("0x{h:x}"),
            public_inputs: format!("0x{h:x}"),
            proof: proof_hex,
            failed_reason: String::new(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(email: &str, t: EmailType) -> ProveTask {
        ProveTask {
            header_hash: "0xabc".into(),
            email: email.into(),
            email_type: t,
        }
    }

    #[tokio::test]
    async fn noop_prover_is_deterministic() {
        let p = NoopProver;
        let a = p.prove(&task("hello", EmailType::Smtp)).await.unwrap();
        let b = p.prove(&task("hello", EmailType::Smtp)).await.unwrap();
        assert_eq!(a, b);
    }

    #[tokio::test]
    async fn noop_prover_differentiates_inputs() {
        let p = NoopProver;
        let a = p.prove(&task("hello", EmailType::Smtp)).await.unwrap();
        let b = p.prove(&task("world", EmailType::Smtp)).await.unwrap();
        assert_ne!(a.proof, b.proof);
    }

    #[tokio::test]
    async fn noop_prover_sets_srs_size_by_email_type() {
        let p = NoopProver;
        let a = p.prove(&task("x", EmailType::OpenId)).await.unwrap();
        let b = p.prove(&task("x", EmailType::Smtp)).await.unwrap();
        assert_eq!(a.public_inputs_num, "0x400");
        assert_eq!(b.public_inputs_num, "0x800");
    }

    #[tokio::test]
    async fn noop_prover_reports_failure_path() {
        let p = NoopProver;
        let a = p.prove(&task("__BAD__oh no", EmailType::Smtp)).await.unwrap();
        assert!(!a.success);
        assert!(!a.failed_reason.is_empty());
        assert!(a.proof.is_empty());
    }

    #[tokio::test]
    async fn noop_prover_preserves_header_hash() {
        let p = NoopProver;
        let mut t = task("x", EmailType::Smtp);
        t.header_hash = "0x1234".into();
        let a = p.prove(&t).await.unwrap();
        assert_eq!(a.header_hash, "0x1234");
    }
}
