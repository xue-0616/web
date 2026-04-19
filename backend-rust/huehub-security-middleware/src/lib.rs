//! Shared security middleware for our actix-web fleet.
//!
//! Three concerns are folded into this crate so downstream services pull
//! in one dependency instead of re-implementing them:
//!
//! 1. [`request_id`] — assigns every request a `uuidv4` (respecting an
//!    incoming `X-Request-ID` header if present) and echoes it back in
//!    the response. The id is also attached to the actix [`Extensions`]
//!    so handlers and the audit sink can read it.
//!
//! 2. [`rate_limit`] — thin wrapper around `actix-governor` that exposes
//!    two sensible presets: a `public` profile (per-IP, 60 req/min) and
//!    a `signing` profile (per-IP, 10 req/min) meant for mutating /
//!    signing endpoints. Services can still wire their own tuned
//!    governor via [`rate_limit::custom`] when needed.
//!
//! 3. [`audit`] — an actix service middleware that writes a structured
//!    record for every request to a [`AuditSink`]. Two sinks are shipped:
//!    an append-only local file sink (`FileSink`) and a `NoopSink` used
//!    for tests. The `s3-sink` crate feature enables an S3 sink suitable
//!    for production compliance storage.
//!
//! Downstream use (abbreviated):
//! ```ignore
//! use huehub_security_middleware::{request_id, rate_limit, audit};
//!
//! HttpServer::new(|| {
//!     App::new()
//!         .wrap(request_id::RequestId::default())
//!         .wrap(audit::AuditMw::new(audit::FileSink::new("/var/log/app/audit.log")))
//!         .service(
//!             web::scope("/v1")
//!                 .wrap(rate_limit::public())
//!                 .route("/quote", web::get().to(quote))
//!                 .service(
//!                     web::scope("/sign")
//!                         .wrap(rate_limit::signing())
//!                         .route("", web::post().to(sign)),
//!                 ),
//!         )
//! });
//! ```

#![forbid(unsafe_code)]
#![deny(missing_docs)]

pub mod audit;
pub mod rate_limit;
pub mod request_id;

/// Re-export the concrete types most callers need.
pub use audit::{AuditMw, AuditRecord, AuditSink, FileSink, NoopSink};
pub use request_id::{RequestId, REQUEST_ID_HEADER};
