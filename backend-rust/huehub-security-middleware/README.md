# huehub-security-middleware

Shared actix-web middleware used across the huehub / unipass Rust fleet.

## What you get

| Module | Purpose |
| --- | --- |
| `request_id` | Mints an `x-request-id` uuid per request, echoes it back in the response, and attaches it to the request extensions so handlers and audit sinks share the same id. |
| `rate_limit::public()` | 60 req/min per IP, burst 10. For reads and catalog endpoints. |
| `rate_limit::signing()` | 10 req/min per IP, burst 3. For any endpoint that signs, mints, airdrops, or mutates balances. |
| `rate_limit::custom()` | Escape hatch for per-wallet / cost-weighted quotas. |
| `audit::AuditMw` | Wraps the app and writes one JSON record per request to an `AuditSink`. |
| `audit::FileSink` | Append-only newline-delimited-JSON sink. |
| `audit::NoopSink` | For tests. |
| `audit::attach_subject` | Handlers call this once they have authenticated the caller; the subject id lands in the audit record. |

## Integration

```toml
# Cargo.toml (downstream service)
[dependencies]
huehub-security-middleware = { path = "../huehub-security-middleware" }
```

```rust
use actix_web::{web, App, HttpServer};
use huehub_security_middleware::{audit, rate_limit, request_id::RequestId};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let sink = audit::FileSink::new("/var/log/paymaster/audit.log");

    HttpServer::new(move || {
        App::new()
            // Order matters: request_id must run first so the audit
            // record can read the id from extensions.
            .wrap(audit::AuditMw::new(sink.clone()))
            .wrap(RequestId)
            .service(
                web::scope("/v1")
                    .wrap(rate_limit::public())
                    .route("/quote", web::get().to(quote))
                    .service(
                        web::scope("/sign")
                            .wrap(rate_limit::signing())
                            .route("", web::post().to(sign)),
                    ),
            )
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
```

## Security notes

- The middleware trusts `X-Forwarded-For` only for **logging**, never for
  rate-limit keying. If you run behind a proxy and need true per-client
  limits, plug a custom key extractor via `rate_limit::custom()` that
  reads the header your proxy actually sets (and verify your proxy
  strips any client-supplied XFF on ingress).
- Audit records never include request / response bodies or arbitrary
  headers. Services that need body capture must redact first and emit a
  separate, tightly-scoped log.
- The `s3-sink` cargo feature pulls in `aws-sdk-s3`. Keep it off in the
  default build so unit tests stay lightweight.

## Schema versioning

`AuditRecord.schema_version` is `1`. Downstream SIEM queries MUST filter
on this field. Bumping it requires a coordinated migration, documented
in `SESSION_REPORT.md`.
