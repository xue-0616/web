//! Smoke test the public handlers without a network round-trip.

use actix_web::{test, web, App};
use huehub_observability::{
    health::{healthz, readyz, readyz_always_ready, ReadinessCheck, ReadinessReport},
    metrics,
};

#[actix_web::test]
async fn healthz_returns_ok_json() {
    let app = test::init_service(App::new().route("/healthz", web::get().to(healthz))).await;
    let req = test::TestRequest::get().uri("/healthz").to_request();
    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());
}

#[actix_web::test]
async fn readyz_always_ready_returns_200() {
    let app = test::init_service(App::new().route("/readyz", web::get().to(readyz_always_ready))).await;
    let req = test::TestRequest::get().uri("/readyz").to_request();
    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());
}

#[actix_web::test]
async fn readyz_returns_503_when_any_dep_unhealthy() {
    let check = ReadinessCheck::new(|| async move {
        ReadinessReport::from_pairs(&[
            ("db", true, None),
            ("redis", false, Some("connection refused".into())),
        ])
    });
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(check))
            .route("/readyz", web::get().to(readyz)),
    )
    .await;
    let req = test::TestRequest::get().uri("/readyz").to_request();
    let res = test::call_service(&app, req).await;
    assert_eq!(res.status().as_u16(), 503);
}

#[actix_web::test]
async fn metrics_endpoint_renders_exposition_format() {
    // `install()` is global; subsequent installs in-process would panic,
    // so we run this test in its own `#[actix_web::test]` and rely on
    // cargo's default one-test-per-process behaviour for isolation.
    let handle = metrics::install();
    // Record a sample so the exposition body isn't empty.
    ::metrics::counter!("smoke_test_total").increment(1);

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(handle))
            .route("/metrics", web::get().to(metrics::metrics_endpoint)),
    )
    .await;
    let req = test::TestRequest::get().uri("/metrics").to_request();
    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());
    let body = test::read_body(res).await;
    let text = std::str::from_utf8(&body).unwrap();
    // Prometheus text format always starts lines with `#` (HELP/TYPE)
    // or the series name.
    assert!(text.contains("smoke_test_total"), "metric missing from /metrics: {text}");
}
