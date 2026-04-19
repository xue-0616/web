//! Open-source replacement for `backend-bin/apple-id-public-key/apple-public-key-monitor`.
//!
//! The closed-source binary's observable behaviour (reverse-engineered from
//! strings in the ELF):
//!
//!   1. Every N seconds, GET `https://appleid.apple.com/auth/keys`.
//!   2. Parse `{ "keys": [ { "kid": "..." } ] }` (JWKS endpoint spec).
//!   3. Compare the set of `kid`s against the previous snapshot.
//!   4. On any **added** or **removed** `kid`, POST a Slack message to the
//!      configured webhook with a human-readable change summary.
//!   5. Persist the current snapshot so a restart doesn't fire a
//!      false-positive "every key is new" notification.
//!
//! Configuration surface (all env-var driven — no `.toml` file needed):
//!
//! | Var                 | Default                                   | Role |
//! |---------------------|-------------------------------------------|------|
//! | `APPLE_KEYS_URL`    | `https://appleid.apple.com/auth/keys`     | JWKS URL |
//! | `SLACK_WEBHOOK_URL` | *required*                                | Target webhook |
//! | `POLL_INTERVAL_SECS`| `300`                                     | Between polls |
//! | `STATE_FILE`        | `./apple-keys.state.json`                 | Snapshot persistence |
//! | `HTTP_TIMEOUT_SECS` | `30`                                      | Per-request timeout |
//! | `RUST_LOG`          | `info`                                    | tracing-subscriber filter |
//!
//! Observable difference from the closed-source ELF:
//!
//! * Slack webhook is **not hardcoded** — `SLACK_WEBHOOK_URL` is mandatory
//!   to avoid leaking a secret like the old binary did (the deployed ELF
//!   shipped the production webhook baked into its rodata).
//! * State file path is configurable (the ELF used the CWD implicitly).

pub mod apple;
pub mod config;
pub mod slack;
pub mod state;
pub mod runner;
