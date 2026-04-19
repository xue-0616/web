# syntax=docker/dockerfile:1.7

FROM rust:1.82-slim-bookworm AS builder
WORKDIR /build
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src tests && echo 'fn main() {}' > src/main.rs && echo '' > src/lib.rs && echo '' > tests/integration.rs && cargo fetch --locked
COPY . .
RUN --mount=type=cache,target=/build/target,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    cargo build --release --locked --bin paymaster-service && \
    cp /build/target/release/paymaster-service /paymaster-service && \
    strip /paymaster-service

FROM debian:bookworm-slim AS runtime
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --home /app --shell /usr/sbin/nologin svc

WORKDIR /app
USER svc:svc
ENV LOG_OUTPUT_FORMAT=json
COPY --from=builder --chown=svc:svc /paymaster-service /usr/local/bin/paymaster-service
EXPOSE 8080
ENTRYPOINT ["paymaster-service"]
