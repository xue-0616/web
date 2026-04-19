//! Open-source replacement for `backend-bin/paymaster-service/paymaster-service`.
//!
//! # What this service does
//!
//! Signs `paymasterAndData` blobs for the ERC-4337 VerifyingPaymaster
//! pattern. A bundler client presents a `UserOperation`; this service
//! (acting as the off-chain policy engine + signer) returns a
//! `paymasterAndData` byte string the user can splice into their op so
//! the on-chain paymaster contract accepts sponsorship.
//!
//! ## Canonical flow
//!
//! ```text
//!   wallet-client  ── pm_sponsorUserOperation ──▶   paymaster-service
//!                                                         │
//!                                                         │ 1. whitelist check
//!                                                         │ 2. build validity window
//!                                                         │ 3. keccak(abi.encode(userOp, validUntil, validAfter))
//!                                                         │ 4. ECDSA-sign
//!                                                         ▼
//!       paymasterAndData = paymaster_addr || validUntil || validAfter || sig
//! ```
//!
//! ## RPC surface (jsonrpsee, namespace `pm`)
//!
//! | Method                      | Params                       | Return |
//! |-----------------------------|------------------------------|--------|
//! | `pm_sponsorUserOperation`   | UserOp, EntryPoint, ChainId  | `SponsorResponse` |
//! | `pm_supportedEntryPoints`   | -                            | `[Address]` |

pub mod config;
pub mod paymaster;
pub mod rpc;
pub mod user_operation;
