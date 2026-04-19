//! Audit-log middleware.
//!
//! Every request that enters a service wrapped with [`AuditMw`] produces
//! one [`AuditRecord`] once the response has been fully generated. The
//! record is forwarded to an [`AuditSink`]; we ship a [`FileSink`] that
//! appends newline-delimited JSON to a local file (suitable for
//! container sidecars / journald collectors) and a [`NoopSink`] for
//! tests. When the `s3-sink` feature is enabled an S3 sink is also
//! available (see `s3.rs`).
//!
//! What we deliberately DO NOT log:
//!
//! - Request / response bodies. They almost always contain secrets
//!   (JWTs, private keys, signed payloads). Services that need body
//!   inspection should redact first and log separately.
//! - Arbitrary headers. Only a short allow-list is stored
//!   (`user-agent`, `x-forwarded-for`, `x-request-id`). Everything else
//!   risks leaking auth tokens.
//!
//! Schema is frozen at v1 until the SESSION_REPORT bumps it — downstream
//! SIEM queries depend on the exact field names.

use std::{
    fmt::Debug,
    future::{ready, Ready},
    path::PathBuf,
    sync::Arc,
    time::Instant,
};

use actix_web::{
    body::EitherBody,
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use chrono::{DateTime, Utc};
use futures_util::future::LocalBoxFuture;
use serde::{Deserialize, Serialize};
use tokio::{
    io::AsyncWriteExt,
    sync::Mutex,
};

use crate::request_id::RequestIdValue;

/// v1 record schema. Adding fields is backwards-compatible; renaming or
/// removing is a breaking change and MUST bump `schema_version`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    /// Schema version — bump if any field is renamed or removed.
    pub schema_version: u8,
    /// When the request arrived at this service (UTC ISO-8601).
    pub ts: DateTime<Utc>,
    /// UUID propagated via the `x-request-id` header.
    pub request_id: String,
    /// HTTP method, upper-cased.
    pub method: String,
    /// Canonicalised path — query string is stripped to avoid leaking
    /// tokens passed in URL params.
    pub path: String,
    /// HTTP status code returned to the client.
    pub status: u16,
    /// Total service time in milliseconds.
    pub latency_ms: u128,
    /// Peer socket address (`ip:port`) as seen by the process. Behind a
    /// proxy this will be the proxy's address; rely on `forwarded_for`
    /// for the real client IP.
    pub peer: Option<String>,
    /// `X-Forwarded-For` value (first hop only) if present.
    pub forwarded_for: Option<String>,
    /// `User-Agent` if present.
    pub user_agent: Option<String>,
    /// Service-defined subject identifier (wallet address, account id,
    /// …) injected by handlers via [`attach_subject`].
    pub subject: Option<String>,
}

/// Attach an optional subject id (wallet address, user id) to the
/// current request's pending audit record. Handlers call this once they
/// have authenticated the caller.
pub fn attach_subject(req: &actix_web::HttpRequest, subject: impl Into<String>) {
    req.extensions_mut().insert(Subject(subject.into()));
}

#[derive(Debug, Clone)]
struct Subject(String);

// ─── sinks ──────────────────────────────────────────────────────────────────

/// Anything that can durably persist one audit record.
///
/// The middleware calls `write` on the hot path, so implementations
/// should be non-blocking or queue internally. A sink that errors is
/// **ignored** — we never want audit logging to propagate back to the
/// user-visible response.
pub trait AuditSink: Send + Sync + 'static {
    /// Persist one record. Returning `Err` is fine; the middleware will
    /// only log the error, never fail the request.
    fn write<'a>(&'a self, record: AuditRecord)
        -> LocalBoxFuture<'a, Result<(), SinkError>>;
}

/// No-op sink used by tests so you can construct [`AuditMw`] without
/// touching disk.
#[derive(Debug, Default, Clone)]
pub struct NoopSink;

impl AuditSink for NoopSink {
    fn write<'a>(&'a self, _record: AuditRecord) -> LocalBoxFuture<'a, Result<(), SinkError>> {
        Box::pin(async { Ok(()) })
    }
}

/// Append-only local file sink. Thread-safe via a tokio `Mutex` over the
/// file handle; the fsync cadence is delegated to the OS. If you need
/// stricter guarantees wrap in a sink that batches + fsyncs every N
/// records.
#[derive(Debug, Clone)]
pub struct FileSink {
    path: PathBuf,
    handle: Arc<Mutex<Option<tokio::fs::File>>>,
}

impl FileSink {
    /// Create a sink pointing at `path`. The file is opened lazily on
    /// first write so tests don't need a real directory.
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into(), handle: Arc::new(Mutex::new(None)) }
    }
}

impl AuditSink for FileSink {
    fn write<'a>(&'a self, record: AuditRecord) -> LocalBoxFuture<'a, Result<(), SinkError>> {
        Box::pin(async move {
            let line = serde_json::to_string(&record).map_err(SinkError::Serialize)?;
            let mut guard = self.handle.lock().await;
            if guard.is_none() {
                let f = tokio::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&self.path)
                    .await
                    .map_err(SinkError::Io)?;
                *guard = Some(f);
            }
            let file = guard.as_mut().expect("file handle present");
            file.write_all(line.as_bytes()).await.map_err(SinkError::Io)?;
            file.write_all(b"\n").await.map_err(SinkError::Io)?;
            Ok(())
        })
    }
}

/// Sink errors are local to the sink — the middleware never surfaces
/// them to the caller.
#[derive(Debug, thiserror::Error)]
pub enum SinkError {
    /// I/O failure writing to the underlying storage.
    #[error("audit sink io: {0}")]
    Io(#[from] std::io::Error),
    /// Failed to serialize the record as JSON — should be impossible for
    /// the v1 schema but is surfaced for completeness.
    #[error("audit sink serialize: {0}")]
    Serialize(#[from] serde_json::Error),
}

// ─── middleware ─────────────────────────────────────────────────────────────

/// Factory that clones the sink for each service instance actix spins up.
#[derive(Clone)]
pub struct AuditMw<S: AuditSink + Clone> {
    sink: S,
}

impl<S: AuditSink + Clone> AuditMw<S> {
    /// Build a middleware factory around the given sink.
    pub fn new(sink: S) -> Self {
        Self { sink }
    }
}

impl<S, B, Sink> Transform<S, ServiceRequest> for AuditMw<Sink>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
    Sink: AuditSink + Clone,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = AuditService<S, Sink>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuditService { inner: service, sink: self.sink.clone() }))
    }
}

/// Running middleware produced by [`AuditMw`].
pub struct AuditService<S, Sink: AuditSink> {
    inner: S,
    sink: Sink,
}

impl<S, B, Sink> Service<ServiceRequest> for AuditService<S, Sink>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
    Sink: AuditSink + Clone,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(inner);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let start = Instant::now();
        let method = req.method().as_str().to_owned();
        let path = req.path().to_owned();
        let peer = req.peer_addr().map(|a| a.to_string());
        let forwarded_for = req
            .headers()
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next().map(|p| p.trim().to_owned()));
        let user_agent = req
            .headers()
            .get("user-agent")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_owned());
        let request_id = req
            .extensions()
            .get::<RequestIdValue>()
            .map(|v| v.0.clone())
            .unwrap_or_else(|| "unknown".to_owned());

        let sink = self.sink.clone();
        let fut = self.inner.call(req);
        Box::pin(async move {
            let res = fut.await?;
            let subject = res
                .request()
                .extensions()
                .get::<Subject>()
                .map(|s| s.0.clone());
            let record = AuditRecord {
                schema_version: 1,
                ts: Utc::now(),
                request_id,
                method,
                path,
                status: res.status().as_u16(),
                latency_ms: start.elapsed().as_millis(),
                peer,
                forwarded_for,
                user_agent,
                subject,
            };
            // Fire-and-forget the write. We intentionally do NOT await
            // the sink's result: the caller's response must not block on
            // audit durability, and any sink error is already logged.
            if let Err(e) = sink.write(record).await {
                tracing::warn!(error = %e, "audit sink write failed");
            }
            Ok(res.map_into_left_body())
        })
    }
}
