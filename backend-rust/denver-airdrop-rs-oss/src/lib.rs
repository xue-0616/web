//! Open-source replacement for `backend-bin/denver-airdrop-rs/denver-airdrop-rs`.
//!
//! EVM NFT airdrop monitor + distributor.
//!
//! # Recovered from the ELF (see `upstream/_reconstructed/denver-airdrop-rs/`)
//!
//! Original source layout was **2 business files** (`main.rs`,
//! `denver_monitor.rs`) plus 2 data files (`config.rs`, `airdrop.rs`)
//! and 2 contract bindings generated via `abigen!` (`module_main.json`,
//! `user_erc721a.json`). Runtime: tokio multi-thread + ethers-rs.
//!
//! Workflow:
//!   1. read `./denver-airdrop.json`
//!   2. connect EVM RPC with retrying HTTP transport
//!   3. poll `ModuleMain.SetSource(address,address)` logs from
//!      `from_block` to `latest`
//!   4. for each unseen (source, receiver) pair, call
//!      `UserERC721A.mint(receiver)` via SignerMiddleware + NonceManager
//!   5. persist result back to `denver-airdrop.json`
//!
//! # Reverse-engineering evidence
//!
//! * ELF strings: `air_drop`, `module_main_addr`, `from_block`,
//!   `Got Duplicate address:`, `Pending Transaction Hash:`, `To Block:`,
//!   `Start to Get Logs from_block=`
//! * Symbol `AriDropInfo` — **note the original typo** (`Ari` not `Air`);
//!   we preserve it to keep `denver-airdrop.json` backwards-compatible.
//! * Event topic: `SetSource(address,address)` from the ABI JSON embedded in rodata.
//!
//! # Module map
//!
//! | Module             | Role |
//! |--------------------|------|
//! | [`config`]         | `Config` (rpc/pk/contracts/from_block + airdrop list) |
//! | [`airdrop`]        | `AirDrop` / `PendingTx` / `AriDropInfo` state |
//! | [`statefile`]      | Atomic load/save of `denver-airdrop.json` |
//! | [`dedup`]          | Receiver deduplication (stateful filter) |
//! | [`block_range`]    | Paginated block-range iterator |
//! | [`error`]          | Crate errors |

pub mod airdrop;
pub mod block_range;
pub mod config;
pub mod dedup;
pub mod error;
pub mod logger;
pub mod statefile;
