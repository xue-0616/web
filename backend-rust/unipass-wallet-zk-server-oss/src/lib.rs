//! Open-source replacement for `backend-bin/unipass-wallet-zk-server/unipass-wallet-zk-server`.
//!
//! # What this service does
//!
//! Generates PLONK proofs that attest "this email body was DKIM-signed by
//! a specific domain, and contains a specific `From:` header at a known
//! offset". UniPass Wallet uses these proofs on-chain to authorise
//! account recovery + guardianship flows using only an email address as
//! the second factor.
//!
//! # Recovered architecture
//!
//! From the 20 MB ELF's `_recovery/RECOVERY.md` we know it contains
//! these internal workspace crates:
//!
//! * `prover`   — PLONK proof generation (arkworks-based)
//! * `scheduler` — Redis-stream task queue consumer
//! * `server`   — actix-web HTTP layer
//! * `configs`  — YAML/JSON config loader
//!
//! And the business types (`struct X with N elements` from rodata):
//!
//! | Struct             | Fields | Purpose |
//! |--------------------|--------|---------|
//! | `GenProofRequest`  | 2      | API input: (email_body, email_type) |
//! | `ProveTask`        | 3      | scheduler queue entry |
//! | `ZkParams`         | 2      | loaded PLONK SRS (size 1024 / 2048) |
//! | `ZkServerConfigs`  | 11     | top-level config |
//! | `MySqlInfo`        | 6      | mysql connection |
//! | `RedisInfo`        | 6      | redis connection |
//!
//! # Open-source strategy
//!
//! - We faithfully reproduce the **architecture, types, DB schema,
//!   Redis task-queue shape, and HTTP surface**.
//! - The PLONK prover itself is behind a [`prover::Prover`] trait. We
//!   ship a [`prover::NoopProver`] for tests and CI; real deployments
//!   wire in e.g. an FFI call into a PLONK circuit (the closed-source
//!   ELF does this via arkworks 0.3 + a hand-written zk-email circuit,
//!   ~4MB .rodata of SRS).
//!
//! See `README.md` for the checklist of what is NOT rewritten (the
//! circuit itself) and the integration contract for plugging in a
//! real prover.

pub mod api;
pub mod config;
pub mod daos;
pub mod error;
pub mod logger;
pub mod mq;
pub mod prover;
pub mod scheduler;
pub mod types;
