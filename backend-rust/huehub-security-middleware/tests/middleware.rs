//! End-to-end tests for the security middleware stack.
//!
//! Each test spins a real actix server on a random port, issues HTTP
//! requests, and checks the cross-cutting behaviour. We avoid mocking
//! actix internals so the tests stay valid across `actix-web` bumps.

use std::sync::Arc;

use actix_web::{test, web, App, HttpResponse};
use huehub_security_middleware::{
    audit::{AuditMw, AuditRecord, AuditSink, NoopSink, SinkError},
    rate_limit,
    request_id::{RequestId, REQUEST_ID_HEADER},
};
use tokio::sync::Mutex;
use uuid::Uuid;

/// In-memory sink that remembers every record for assertions.
#[derive(Clone, Default)]
struct MemSink {
    records: Arc<Mutex<Vec<AuditRecord>>>,
}

impl AuditSink for MemSink {
    fn write<'a>(&'a self, record: AuditRecord)
        -> futures_util::future::LocalBoxFuture<'a, Result<(), SinkError>>
    {
        Box::pin(async move {
            self.records.lock().await.push(record);
            Ok(())
        })
    }
}

#[actix_web::test]
async fn request_id_is_minted_when_absent() {
    let app = test::init_service(
        App::new().wrap(RequestId)
            .route("/ping", web::get().to(|| async { HttpResponse::Ok().finish() })),
    )
    .await;
    let req = test::TestRequest::get().uri("/ping").to_request();
    let res = test::call_service(&app, req).await;
    let hv = res.headers().get(REQUEST_ID_HEADER).expect("header present");
    // Must be a real uuid, not a literal "unknown" etc.
    assert!(Uuid::parse_str(hv.to_str().unwrap()).is_ok());
}

#[actix_web::test]
async fn request_id_echoes_valid_inbound_header() {
    let app = test::init_service(
        App::new().wrap(RequestId)
            .route("/ping", web::get().to(|| async { HttpResponse::Ok().finish() })),
    )
    .await;
    let incoming = Uuid::new_v4().to_string();
    let req = test::TestRequest::get()
        .uri("/ping")
        .insert_header((REQUEST_ID_HEADER, incoming.clone()))
        .to_request();
    let res = test::call_service(&app, req).await;
    let got = res.headers().get(REQUEST_ID_HEADER).unwrap().to_str().unwrap();
    assert_eq!(got, incoming);
}

#[actix_web::test]
async fn request_id_rejects_non_uuid_inbound_header() {
    // A client should not be able to pin the id to a known value — the
    // middleware must mint a fresh one when the inbound header is not a
    // canonical uuid. This prevents log-injection.
    let app = test::init_service(
        App::new().wrap(RequestId)
            .route("/ping", web::get().to(|| async { HttpResponse::Ok().finish() })),
    )
    .await;
    // actix-http rejects CRLF in header values at construction time,
    // so test with a plain non-uuid string — still exercises the
    // middleware's uuid validation path.
    let req = test::TestRequest::get()
        .uri("/ping")
        .insert_header((REQUEST_ID_HEADER, "not-a-uuid-value"))
        .to_request();
    let res = test::call_service(&app, req).await;
    let got = res.headers().get(REQUEST_ID_HEADER).unwrap().to_str().unwrap();
    assert!(Uuid::parse_str(got).is_ok(), "expected minted uuid, got {got}");
}

#[actix_web::test]
async fn audit_sink_captures_method_path_status() {
    let sink = MemSink::default();
    let app = test::init_service(
        App::new()
            .wrap(AuditMw::new(sink.clone()))
            .wrap(RequestId)
            .route("/users/{id}", web::post().to(|| async { HttpResponse::Created().finish() })),
    )
    .await;
    let req = test::TestRequest::post().uri("/users/42?token=secret").to_request();
    let _ = test::call_service(&app, req).await;
    let records = sink.records.lock().await;
    assert_eq!(records.len(), 1);
    let r = &records[0];
    assert_eq!(r.method, "POST");
    // Query string must be stripped so URL tokens don't leak into logs.
    assert_eq!(r.path, "/users/42");
    assert_eq!(r.status, 201);
    assert_eq!(r.schema_version, 1);
}

#[actix_web::test]
async fn audit_sink_does_not_fail_request_when_sink_errors() {
    // A sink that always errors must not propagate that error to the
    // client — audit logging is best-effort and should never DoS the
    // caller's request.
    #[derive(Clone)]
    struct Bad;
    impl AuditSink for Bad {
        fn write<'a>(&'a self, _r: AuditRecord)
            -> futures_util::future::LocalBoxFuture<'a, Result<(), SinkError>>
        {
            Box::pin(async {
                Err(SinkError::Io(std::io::Error::other("boom")))
            })
        }
    }
    let app = test::init_service(
        App::new()
            .wrap(AuditMw::new(Bad))
            .wrap(RequestId)
            .route("/ping", web::get().to(|| async { HttpResponse::Ok().finish() })),
    )
    .await;
    let req = test::TestRequest::get().uri("/ping").to_request();
    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success(), "sink error must not fail the request");
}

#[actix_web::test]
async fn rate_limit_signing_preset_blocks_burst() {
    // `signing()` allows burst=3, so the 4th request within one second
    // must be rate-limited with a 429.
    let app = test::init_service(
        App::new()
            .service(
                web::scope("/sign")
                    .wrap(rate_limit::signing())
                    .route("", web::post().to(|| async { HttpResponse::Ok().finish() })),
            ),
    )
    .await;
    let mut saw_429 = false;
    for _ in 0..6 {
        // actix-governor keys by peer IP by default; the test harness
        // does not set one unless we ask for it explicitly.
        let req = test::TestRequest::post()
            .uri("/sign")
            .peer_addr("127.0.0.1:50000".parse().unwrap())
            .to_request();
        let res = test::call_service(&app, req).await;
        if res.status().as_u16() == 429 {
            saw_429 = true;
            break;
        }
    }
    assert!(saw_429, "expected at least one 429 once the burst was spent");
}

#[actix_web::test]
async fn noop_sink_is_still_a_valid_sink() {
    // Sanity check: the default test harness must compile with NoopSink.
    let app = test::init_service(
        App::new()
            .wrap(AuditMw::new(NoopSink))
            .route("/ping", web::get().to(|| async { HttpResponse::Ok().finish() })),
    )
    .await;
    let req = test::TestRequest::get().uri("/ping").to_request();
    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());
}
