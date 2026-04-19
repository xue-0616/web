//! Rate-limit presets backed by [`actix_governor`].
//!
//! Two pre-baked profiles cover ~95% of our endpoints:
//!
//! - [`public`] — 60 req/min per IP. For unauthenticated reads: quotes,
//!   health checks, catalog fetches.
//! - [`signing`] — 10 req/min per IP. For mutating / signing endpoints
//!   where a burst is almost always abuse (sign-tx, airdrop,
//!   password-reset).
//!
//! For anything exotic (per-wallet, weighted by request cost, etc.)
//! callers build a [`GovernorConfig`] directly with [`custom`].
//!
//! NOTE: `actix-governor` keys by the peer's socket addr by default. If
//! the service sits behind a reverse proxy, pair this with the upstream
//! `PeerIpKeyExtractor` replaced by a header-based one that reads
//! `X-Forwarded-For` — otherwise every request appears to come from the
//! proxy and the limit never fires.

use actix_governor::{Governor, GovernorConfig, GovernorConfigBuilder, PeerIpKeyExtractor};

/// Preset for public reads. 60 requests/minute, burst 10.
pub fn public() -> Governor<PeerIpKeyExtractor, governor::middleware::NoOpMiddleware> {
    let conf = GovernorConfigBuilder::default()
        .per_second(1)        // steady state
        .burst_size(10)       // allow short spikes
        .finish()
        .expect("valid governor config");
    Governor::new(&conf)
}

/// Preset for signing / mutating endpoints. 10 requests/minute, burst 3.
pub fn signing() -> Governor<PeerIpKeyExtractor, governor::middleware::NoOpMiddleware> {
    let conf = GovernorConfigBuilder::default()
        .per_second(6)  // 1 req / 6 s → 10 req/min steady
        .burst_size(3)
        .finish()
        .expect("valid governor config");
    Governor::new(&conf)
}

/// Escape hatch for services that need bespoke rate-limiting parameters
/// (e.g. a per-wallet extractor, a cost-weighted quota). Callers pass a
/// fully-built [`GovernorConfig`]; we just wrap it in the middleware.
pub fn custom<K>(config: &GovernorConfig<K, governor::middleware::NoOpMiddleware>) -> Governor<K, governor::middleware::NoOpMiddleware>
where
    K: actix_governor::KeyExtractor + 'static,
{
    Governor::new(config)
}
