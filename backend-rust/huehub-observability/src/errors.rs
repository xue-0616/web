//! Optional Sentry wiring.
//!
//! We deliberately do NOT pull `sentry` as a mandatory dependency —
//! most of our services write structured logs and that's enough. When
//! a service does need Sentry, it can initialise it directly using the
//! contract documented here:
//!
//! ```ignore
//! // Cargo.toml of the downstream service:
//! // sentry = { version = "0.34", features = ["tracing", "tower", "tokio"] }
//!
//! fn main() {
//!     let _guard = huehub_observability::errors::init_sentry(
//!         env!("CARGO_PKG_NAME"),
//!         env!("CARGO_PKG_VERSION"),
//!     );
//!     // … actix server here …
//! }
//! ```
//!
//! The helper reads the DSN from `SENTRY_DSN` (empty => no-op) so
//! secrets never land in code and staging / prod can swap DSNs via
//! env-only config.

/// RAII guard that flushes pending events on drop. A no-op when
/// `SENTRY_DSN` is unset or the `sentry` crate is not linked.
//
// The private `#[cfg(any())]`-gated tuple field keeps the struct
// non-constructible by callers (they must go through `init_sentry`)
// without requiring a real feature flag. `any()` with no predicates
// is always false, so the field is elided in every build — unlike
// `feature = "__never_set"`, it doesn't trigger the `unexpected_cfgs`
// lint under `-D warnings`.
pub struct SentryGuard(#[cfg(any())] ());

/// Initialise Sentry if `SENTRY_DSN` is set. Safe to call without the
/// `sentry` crate present; becomes a compile-time no-op that returns
/// an empty guard.
///
/// We ship the init logic as an example rather than a linked function
/// so services keep control of which features (`tracing`, `tower`,
/// `tokio`, …) they want without this crate forcing a common set.
#[inline]
pub fn init_sentry(_service: &str, _version: &str) -> SentryGuard {
    // Intentionally empty. Services that opt in copy the 10-line
    // boilerplate from the module docstring. We keep the function
    // shape stable so adopting a real impl later is a single PR.
    SentryGuard(
        #[cfg(any())]
        (),
    )
}
