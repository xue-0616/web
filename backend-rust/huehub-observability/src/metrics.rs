//! Prometheus exporter wiring.
//!
//! Services already use the `metrics` façade (e.g. `metrics::counter!`)
//! throughout the codebase. This module installs the recorder and
//! produces a [`PrometheusHandle`] that renders the exposition format
//! from the registered metrics.
//!
//! Buckets for latency histograms are fixed at `[5ms, 10ms, 25ms, 50ms,
//! 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s]` — a reasonable span for
//! web-facing services. Callers who need different buckets should
//! register their own histogram with the `metrics::describe_histogram!`
//! macro *after* `install()` returns.

use actix_web::{web, HttpResponse, Responder};
use metrics_exporter_prometheus::{Matcher, PrometheusBuilder, PrometheusHandle};

const LATENCY_BUCKETS_SECONDS: &[f64] = &[
    0.005, 0.010, 0.025, 0.050, 0.100, 0.250, 0.500, 1.0, 2.5, 5.0, 10.0,
];

/// Install the Prometheus recorder and return a handle. Call once at
/// startup. The handle is cheap to clone and can be put into
/// `web::Data` for use from the `/metrics` endpoint.
pub fn install() -> PrometheusHandle {
    let builder = PrometheusBuilder::new()
        .set_buckets_for_metric(
            Matcher::Suffix("_seconds".to_owned()),
            LATENCY_BUCKETS_SECONDS,
        )
        .expect("valid bucket config");
    builder
        .install_recorder()
        .expect("install prometheus recorder")
}

/// Actix handler for `GET /metrics`. Expects the `PrometheusHandle` to
/// be available via `web::Data`.
pub async fn metrics_endpoint(handle: web::Data<PrometheusHandle>) -> impl Responder {
    HttpResponse::Ok()
        .content_type("text/plain; version=0.0.4")
        .body(handle.render())
}
