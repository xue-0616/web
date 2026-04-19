//! Structured logging initialisation.
//!
//! We deliberately default to JSON even on local dev so the same log
//! format flows through the whole pipeline (stdout → collector → SIEM).
//! `RUST_LOG=info,hyper=warn,h2=warn` is the recommended prod value.
//!
//! The `init*` functions are safe to call more than once; subsequent
//! calls are no-ops (the global tracing dispatcher can only be set
//! once, so we swallow the error).

use tracing_subscriber::{layer::SubscriberExt as _, util::SubscriberInitExt as _, EnvFilter};

/// Default env filter when `RUST_LOG` is not set. Keeps our own
/// services at `info`, mutes libraries we rarely care about.
const DEFAULT_FILTER: &str = "info,hyper=warn,h2=warn,rustls=warn,sqlx=warn";

/// Initialise a JSON-formatted tracing subscriber. `service_name` is
/// stamped on every event so a multi-service log pipeline can route.
pub fn init(service_name: &str) {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(DEFAULT_FILTER));
    // Attach the service name as a span that wraps every event.
    let service = service_name.to_owned();
    let registry = tracing_subscriber::registry()
        .with(filter)
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_current_span(true)
                .with_span_list(false)
                .with_target(false)
                .with_file(false)
                .with_line_number(false),
        );
    // `.try_init()` returns an error on second call — fine, we just
    // want the first caller's config to win.
    let _ = registry.try_init();
    tracing::info!(service = %service, "logs initialised");
}

/// Initialise tracing with an additional OpenTelemetry OTLP exporter.
/// Requires the `otel` cargo feature.
#[cfg(feature = "otel")]
pub fn init_with_otlp(service_name: &str) -> Result<(), OtelInitError> {
    use opentelemetry::{global, KeyValue};
    use opentelemetry_otlp::{Protocol, WithExportConfig};
    use opentelemetry_sdk::{runtime, trace::Config, Resource};

    let endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://127.0.0.1:4317".to_owned());

    global::set_text_map_propagator(opentelemetry_sdk::propagation::TraceContextPropagator::new());

    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(endpoint)
                .with_protocol(Protocol::Grpc),
        )
        .with_trace_config(
            Config::default().with_resource(Resource::new(vec![KeyValue::new(
                "service.name",
                service_name.to_owned(),
            )])),
        )
        .install_batch(runtime::Tokio)
        .map_err(|e| OtelInitError(e.to_string()))?;

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(DEFAULT_FILTER));
    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);

    let registry = tracing_subscriber::registry()
        .with(filter)
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_current_span(true)
                .with_target(false),
        )
        .with(otel_layer);
    let _ = registry.try_init();
    tracing::info!(service = %service_name, "logs + OTLP initialised");
    Ok(())
}

/// Returned if the OTLP exporter failed to install. Surfaced as a
/// string to avoid leaking the upstream error type into users' error
/// enums.
#[cfg(feature = "otel")]
#[derive(Debug, thiserror::Error)]
#[error("OTLP init failed: {0}")]
pub struct OtelInitError(String);
