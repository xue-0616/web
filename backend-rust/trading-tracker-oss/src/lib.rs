//! Library crate — re-exports every module so that integration tests under
//! `tests/` can exercise the full wiring. The binary entry point in
//! `src/main.rs` lives in parallel and depends on nothing else in the tree.
//!
//! This is the standard `lib + bin` layout for Rust services that want:
//!   * fast unit tests inside each module (`#[cfg(test)] mod tests`),
//!   * black-box integration tests in `tests/*.rs` that import from
//!     `trading_tracker_oss::*` just like a third-party consumer would,
//!   * a thin binary that just wires config → runtime and returns.

#![allow(dead_code)]

pub mod config;
pub mod cursor_store;
pub mod dex_pool;
pub mod error;
pub mod logger;
pub mod package;
pub mod pb;
pub mod rpc;
pub mod token_price_manager;
