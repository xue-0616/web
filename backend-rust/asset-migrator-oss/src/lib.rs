//! Open-source replacement for `backend-bin/asset-migrator/unipass_asset_migrator`.
//!
//! # What this service does
//!
//! Cross-chain ERC-20 / native asset migration:
//!
//! ```text
//!   ┌──────────┐  deposit   ┌─────────────┐  signs tx  ┌──────────┐
//!   │  User    ├───────────▶│  Deposit    │◀───────────│ Custody  │
//!   │ (source) │            │   address   │            │  Wallet  │
//!   └──────────┘            │ (watched)   │            │   API    │
//!                           └──────┬──────┘            └──────────┘
//!                                  │ indexer observes
//!                                  ▼
//!                           ┌─────────────┐  enqueue   ┌──────────┐
//!                           │  Service    ├───────────▶│  Redis   │
//!                           │ (this crate)│            │  stream  │
//!                           └─────────────┘            └─────┬────┘
//!                                                            │ drain
//!                                                            ▼
//!                           ┌─────────────┐  RPC send  ┌──────────────┐
//!                           │  Submitter  ├───────────▶│ Destination  │
//!                           │  (signer)   │            │   chain      │
//!                           └─────────────┘            └──────────────┘
//! ```
//!
//! # Module map (mirrors the closed-source binary's internal crates)
//!
//! | Recovered crate | This crate's module | Role |
//! |---|---|---|
//! | `configs`           | [`config`]                  | Env + JSON config loader |
//! | `logger`            | [`logger`]                  | tracing-subscriber bootstrap |
//! | `daos`              | [`daos`]                    | sqlx DAOs + FromRow structs |
//! | `api` / `api_middleware` / `api_utils` | [`api`] | actix-web HTTP layer |
//! | `services`          | [`services`]                | Custody wallet client, deposit address allocator |
//! | `submitter`         | [`workers::submitter`]      | Outbound tx signer + sender |
//! | `tx_processor`      | [`workers::tx_processor`]   | Inbound event → outbound tx builder |
//! | `workers`           | [`workers`]                 | Background task registry |
//! | `mq`                | [`mq`]                      | Redis stream wrapper |
//!
//! # Running
//!
//! ```bash
//! MYSQL_URL=mysql://am:am@127.0.0.1:3306/asset_migrator \
//! REDIS_URL=redis://127.0.0.1:6379/ \
//! CONFIG_PATH=./config/dev.json \
//! SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... \
//!   asset-migrator
//! ```

pub mod api;
pub mod config;
pub mod daos;
pub mod error;
pub mod logger;
pub mod mq;
pub mod services;
pub mod workers;
