//! Open-source replacement for `backend-bin/unipass-snap-service/snap-server`.
//!
//! # What this service does
//!
//! Backend for the UniPass MetaMask Snap (and Google OpenID fallback flow):
//!
//! 1. **Account provisioning** — on first login, creates a `snap_account`
//!    row mapping a Snap-derived EVM wallet address (or a Google `sub`) to
//!    an internal account id.
//! 2. **Free-quota signing** — issues `free_sig` byte blobs the wallet
//!    splices into its transaction so the on-chain free-quota contract
//!    accepts a gas-sponsored execution.
//! 3. **Relayer orchestration** — once a transaction has a valid free sig,
//!    forwards it to an outbound relayer (via HTTP) and tracks its status
//!    in `snap_account_transaction` through init → signed → on-chain → final.
//!
//! # Module map (matches the closed-source binary's internal crates)
//!
//! | Recovered crate  | This crate's module   | Role |
//! |------------------|-----------------------|------|
//! | `snap_config`    | [`config`]            | JSON / env config |
//! | `snap_logger`    | [`logger`]            | tracing-subscriber init |
//! | `daos_snap`      | [`daos`]              | sqlx DAOs (2 tables) |
//! | `snap_redis`     | [`mq`]                | deadpool-redis helper |
//! | `snap_contract`  | [`contract`]          | on-chain free-quota contract client |
//! | `snap_server`    | [`api`]               | actix-web HTTP layer |
//! | `snap_common`    | [`common`]            | shared enums/types |
//! | `api_middleware` | [`auth`]              | JWT auth middleware |

pub mod api;
pub mod auth;
pub mod common;
pub mod config;
pub mod contract;
pub mod daos;
pub mod error;
pub mod logger;
pub mod mq;
pub mod sigverify;
