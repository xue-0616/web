//! Integration-test template using `testcontainers` + a real Postgres.
//!
//! Services in this fleet that own persistent state (paymaster,
//! dexauto-trading-server, payment-server, …) should copy this file
//! into their own `tests/` directory, replace the handlers with the
//! real app's routes, and tighten the assertions.
//!
//! WHY THIS LIVES HERE
//! -------------------
//! We keep the canonical template alongside the shared middleware
//! crate so a single change propagates by diff-review; the alternative
//! (each service owns a subtly-divergent copy) is how integration
//! tests rot in the first place.
//!
//! RUNNING
//! -------
//! Requires the local docker daemon to be reachable — the CI job runs
//! this on GitHub's `ubuntu-latest` runner where docker is pre-installed.
//! Locally: `cargo test --test integration_template -- --ignored`.
//!
//! We mark the test `#[ignore]` by default so `cargo test` on a dev box
//! without docker stays green. Services that adopt the template flip
//! the `#[ignore]` to `cfg_attr(not(ci), ignore)` once their CI is
//! wired.

#![allow(dead_code, unused_imports)] // template — downstream unwraps as needed

use std::time::Duration;

use actix_web::{test, web, App, HttpResponse};

/// Replace this with your service's real router. The template wires a
/// single `/ping` so the scaffolding compiles without the service
/// code being present.
async fn ping() -> HttpResponse {
    HttpResponse::Ok().body("pong")
}

/// Wait up to `timeout` for the closure to return `Ok(_)`. Used when
/// the container is reachable but the app inside is still migrating.
async fn wait_until<T, F, Fut, E>(timeout: Duration, mut f: F) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
{
    let deadline = std::time::Instant::now() + timeout;
    let mut last_err: Option<E> = None;
    loop {
        match f().await {
            Ok(v) => return Ok(v),
            Err(e) => {
                last_err = Some(e);
                if std::time::Instant::now() >= deadline {
                    return Err(last_err.unwrap());
                }
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }
    }
}

/// Smoke — the ONLY universal assertion we can make across services:
/// the app responds to a health-style ping when hosted inside the
/// actix test harness. Downstream services extend this to cover db
/// migrations, auth handshake, and one representative write path.
#[actix_web::test]
#[ignore = "template — enable per-service after wiring a real router"]
async fn ping_ok() {
    let app = test::init_service(App::new().route("/ping", web::get().to(ping))).await;
    let req = test::TestRequest::get().uri("/ping").to_request();
    let res = test::call_service(&app, req).await;
    assert!(res.status().is_success());
}

/// Shape that services copy and flesh out. Start a postgres container,
/// apply migrations, spin up the app against the container's DSN, then
/// run end-to-end assertions.
///
/// Pseudocode (commented out so the template compiles without
/// `testcontainers` as a dependency):
///
/// ```ignore
/// use testcontainers::{clients, images::postgres::Postgres};
///
/// #[actix_web::test]
/// #[ignore = "requires docker"]
/// async fn db_roundtrip() {
///     let docker = clients::Cli::default();
///     let pg = docker.run(Postgres::default());
///     let port = pg.get_host_port_ipv4(5432);
///     let dsn = format!("postgres://postgres:postgres@127.0.0.1:{port}/postgres");
///
///     sqlx::migrate!("../migrations").run(&pool_from(&dsn).await).await.unwrap();
///
///     let app = build_app_with_dsn(&dsn);
///     // … exercise routes …
/// }
/// ```
#[actix_web::test]
#[ignore = "template — wire testcontainers::Cli + run_migrations before enabling"]
async fn db_roundtrip_stub() {
    // This stub exists so a newly-adopted copy has a visible second
    // test to flesh out. Safe to delete once the real version exists.
}
