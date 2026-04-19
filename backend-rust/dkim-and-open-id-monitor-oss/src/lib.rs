//! Open-source replacement for `backend-bin/dkim-and-open-id-monitor/dkim-and-open-id-monitor`.
//!
//! # What this service does
//!
//! Continuously reconciles three sources of truth to detect key rotation
//! events that have not yet been propagated to the wallet contracts:
//!
//! 1. **DNS** — DKIM public keys live at `{selector}._domainkey.{domain}`
//!    as TXT records.
//! 2. **OIDC** — Each identity provider (Google, Apple, etc.) exposes a
//!    `jwks_uri` from which we pull current signing certs.
//! 3. **EVM chain logs** — A "DKIM/OpenID keys" contract emits a log every
//!    time a new key fingerprint is registered. Recovered symbols:
//!    `DkimKeysLogParser`, `src/open_id_keys_log_parser.rs`,
//!    `Unknown Event Topic`.
//!
//! Mismatches → **Slack webhook alert**. The closed-source ELF logs to
//! `slack_webhook_url` (recovered config field).
//!
//! # Recovered config (11 fields)
//!
//! ```text
//!   slack_webhook_url           imap_server_url   smtp_server
//!   certs_check_interval_secs   username          iss
//!   chain_check_interval_secs   password          certs_url
//!   check_chain_sync            tls_type          (src)
//! ```
//!
//! (The stray `src` token in rodata is a log prefix, not a config field.)
//!
//! # Module map
//!
//! | This crate         | Role |
//! |--------------------|------|
//! | [`config`]         | JSON config + validation |
//! | [`jwks`]           | Fetch + parse OIDC JWKS (HTTP) |
//! | [`dkim_dns`]       | Resolve DKIM TXT records (trait + live impl) |
//! | [`chain_log`]      | Decode `DkimKeysLog` / `OpenIdKeysLog` events |
//! | [`reconciler`]     | Diff computed-vs-chain fingerprints |
//! | [`slack`]          | POST alert to Slack webhook |
//! | [`error`]          | Crate error type |

pub mod chain_log;
pub mod config;
pub mod dkim_dns;
pub mod error;
pub mod jwks;
pub mod logger;
pub mod reconciler;
pub mod slack;
