//! Open-source replacement for `backend-bin/huehub-rgbpp-indexer/rgbpp`
//! (18 MB stripped Rust ELF).
//!
//! # What the original does
//!
//! Indexes RGB++ token activity across **Bitcoin + CKB** and exposes a
//! JSON-RPC façade with six methods (recovered from rodata):
//!
//! | Method           | Request / Response types |
//! |------------------|---------------------------|
//! | `rgbpp_balances` | `AccountBalancesRequest` → `AccountBalancesResponse` |
//! | `rgbpp_holders`  | `TokenHoldersRequest` → `TokenHoldersResponse` |
//! | `rgbpp_tokens`   | `TokensRequest` → `TokenInfo[]` |
//! | `rgbpp_by_input` | `(tx_hash, vin)` → `RgbppEvent` |
//! | `rgbpp_by_output`| `(tx_hash, vout)` → `RgbppEvent` |
//! | `rgbpp_script`   | `AccountTokenOutpointsRequest` → `AccountTokenOutpointsResponse` |
//!
//! Persistent storage: **`redb`** (256 symbols in the ELF — pure Rust
//! embedded KV, no external dependency). Tables recovered:
//! `rgbpp_balances` / `rgbpp_holders` / `rgbpp_tokens` /
//! `rgbpp_by_input` / `rgbpp_by_output` / `rgbpp_script` /
//! `rgbpp_transferable`.
//!
//! # Open-source approach
//!
//! The RGB++ protocol itself is implemented upstream in
//! `upstream/rgbpp/crates/core` (Apache-2.0). We **do not** re-derive
//! the molecule schemas here; the indexer's job is strictly:
//!
//!   1. Subscribe to CKB tip + Bitcoin tip
//!   2. Decode each new CKB block's transactions via the upstream
//!      `rgbpp` crate to extract RGB++ events
//!   3. Persist to redb
//!   4. Answer RPC queries
//!
//! This crate ships:
//!
//! * **Data types** — `TokenInfo`, `AccountBalance`, `TokenHolder`,
//!   `OutPoint`, `RgbppEvent` — shape matches the recovered
//!   `*Request/*Response` struct symbols.
//! * **`Dao` trait** — CRUD interface the RPC layer calls. We ship a
//!   `MemoryDao` (BTreeMap) for tests and leave the redb impl as a
//!   wiring task (redb's API is ~30 LOC to connect).
//! * **JSON-RPC server** via jsonrpsee with all 6 methods, answering
//!   from any `Dao` impl.
//! * **Pagination primitives** matching the `TokenHoldersResponse.next`
//!   cursor field recovered from rodata.

pub mod config;
pub mod dao;
pub mod error;
pub mod logger;
pub mod pagination;
pub mod redb_dao;
pub mod rpc;
pub mod types;
