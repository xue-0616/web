//! Liveness + readiness endpoints.
//!
//! Kubernetes (and Nomad, and ECS) distinguishes between:
//!
//! - *liveness* — "is the process still a going concern?" A failing
//!   liveness probe kills the pod. Should be a dirt-cheap, no-I/O
//!   check.
//! - *readiness* — "should I receive traffic right now?" A failing
//!   readiness probe removes the pod from the Service endpoints list
//!   but does NOT kill it. Use for warm-up, migrations, dependency
//!   back-pressure.
//!
//! We expose both as distinct actix handlers so services can use them
//! as-is or customise the readiness check via [`ReadinessCheck`].

use std::{future::Future, pin::Pin, sync::Arc};

use actix_web::{web, HttpResponse, Responder};
use serde::Serialize;

/// Handler for `GET /healthz`. Always returns 200 — the only purpose is
/// to prove that the event loop is responsive.
pub async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(HealthBody { status: "ok" })
}

/// Default `GET /readyz` that always reports ready. Useful for services
/// that don't have an async dependency to wait on.
pub async fn readyz_always_ready() -> impl Responder {
    HttpResponse::Ok().json(HealthBody { status: "ready" })
}

/// Pluggable readiness check. Callers build one at startup and wire it
/// via [`readyz`]. The check is an async closure returning a
/// [`ReadinessReport`] so implementations can fan out to multiple
/// dependencies and aggregate.
#[derive(Clone)]
pub struct ReadinessCheck(
    Arc<dyn Fn() -> Pin<Box<dyn Future<Output = ReadinessReport> + Send>> + Send + Sync>,
);

impl ReadinessCheck {
    /// Construct from a user-supplied async function.
    pub fn new<F, Fut>(f: F) -> Self
    where
        F: Fn() -> Fut + Send + Sync + 'static,
        Fut: Future<Output = ReadinessReport> + Send + 'static,
    {
        Self(Arc::new(move || Box::pin(f())))
    }

    /// Run the check once.
    pub async fn run(&self) -> ReadinessReport {
        (self.0)().await
    }
}

/// Report returned by a readiness check. The service is ready iff every
/// dependency reports ready. Returning `ready=false` maps to a 503.
#[derive(Debug, Clone, Serialize)]
pub struct ReadinessReport {
    /// Overall verdict.
    pub ready: bool,
    /// Per-dependency details. Keyed by a short stable name ("db",
    /// "redis", "rpc").
    pub checks: Vec<DepCheck>,
}

/// One dependency's contribution to the overall readiness report.
#[derive(Debug, Clone, Serialize)]
pub struct DepCheck {
    /// Short dependency name, e.g. `"db"`.
    pub name: String,
    /// `true` if the dependency is currently usable.
    pub ok: bool,
    /// Optional human message (error detail, last ping latency).
    pub detail: Option<String>,
}

impl ReadinessReport {
    /// Build a report from a list of named booleans.
    pub fn from_pairs(pairs: &[(&str, bool, Option<String>)]) -> Self {
        let checks: Vec<DepCheck> = pairs
            .iter()
            .map(|(n, ok, d)| DepCheck { name: (*n).into(), ok: *ok, detail: d.clone() })
            .collect();
        let ready = checks.iter().all(|c| c.ok);
        Self { ready, checks }
    }
}

/// Actix handler for `GET /readyz`. Expects a [`ReadinessCheck`] in
/// `app_data`.
pub async fn readyz(check: web::Data<ReadinessCheck>) -> impl Responder {
    let report = check.run().await;
    if report.ready {
        HttpResponse::Ok().json(&report)
    } else {
        HttpResponse::ServiceUnavailable().json(&report)
    }
}

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
}
