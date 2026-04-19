# syntax=docker/dockerfile:1.7

# Stage 1 — builder
FROM rust:1.82-slim-bookworm AS builder

# rustls-tls backend means no OpenSSL dep — slimmer build.
WORKDIR /build

COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src tests && \
    echo 'fn main() {}' > src/main.rs && \
    echo '' > src/lib.rs && \
    echo '' > tests/integration.rs && \
    cargo fetch --locked

COPY src ./src
COPY tests ./tests

RUN --mount=type=cache,target=/build/target,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    cargo build --release --locked --bin apple-public-key-monitor && \
    cp /build/target/release/apple-public-key-monitor /apple-public-key-monitor && \
    strip /apple-public-key-monitor

# Stage 2 — runtime
FROM debian:bookworm-slim AS runtime

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --home /app --shell /usr/sbin/nologin monitor

WORKDIR /app
USER monitor:monitor

ENV STATE_FILE=/app/data/apple-keys.state.json \
    LOG_OUTPUT_FORMAT=json \
    POLL_INTERVAL_SECS=300
RUN mkdir -p /app/data || true

COPY --from=builder --chown=monitor:monitor /apple-public-key-monitor /usr/local/bin/apple-public-key-monitor

# No HTTP port — this is a pure outbound monitor.
# Healthcheck: just verify the process is alive; liveness/readiness in k8s
# should check whether `last_success_unix` in STATE_FILE is recent, which
# requires a sidecar. For v1 we keep it simple.

ENTRYPOINT ["apple-public-key-monitor"]
