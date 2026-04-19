//! Shared observability primitives for the actix-web fleet.
//!
//! Three modules, each self-contained so callers opt in incrementally:
//!
//! - [`logs`] — initialise `tracing` with a structured JSON formatter
//!   gated by `RUST_LOG`. Sets the default crate filter so noisy
//!   libraries (`h2`, `hyper`, `sqlx`) don't bury our app events.
//!
//! - [`metrics`] — builds a `PrometheusHandle` on a fixed global bucket
//!   set and installs the recorder. Hook the returned handle into
//!   [`metrics::metrics_endpoint`] to expose `/metrics` from the same
//!   actix app.
//!
//! - [`health`] — `GET /healthz` (liveness) and `GET /readyz`
//!   (readiness). Liveness is a static `200 OK`; readiness invokes a
//!   user-supplied closure so services can return 503 while warm-up /
//!   migration is pending.
//!
//! When the `otel` cargo feature is enabled, [`logs::init_with_otlp`]
//! also installs an OTLP tracer that forwards `tracing` spans to a
//! collector configured via the standard `OTEL_EXPORTER_OTLP_ENDPOINT`
//! environment variable.
//!
//! # Integration cheat-sheet
//!
//! ```ignore
//! use actix_web::{App, HttpServer, web};
//! use huehub_observability::{logs, metrics, health};
//!
//! #[actix_web::main]
//! async fn main() -> std::io::Result<()> {
//!     logs::init("paymaster-service");
//!     let prom = metrics::install();
//!
//!     HttpServer::new(move || {
//!         App::new()
//!             .app_data(web::Data::new(prom.clone()))
//!             .route("/healthz", web::get().to(health::healthz))
//!             .route("/readyz",  web::get().to(health::readyz_always_ready))
//!             .route("/metrics", web::get().to(metrics::metrics_endpoint))
//!             // …your real routes here…
//!     })
//!     .bind(("0.0.0.0", 8080))?
//!     .run()
//!     .await
//! }
//! ```

#![forbid(unsafe_code)]
#![deny(missing_docs)]

pub mod errors;
pub mod health;
pub mod logs;
pub mod metrics;
