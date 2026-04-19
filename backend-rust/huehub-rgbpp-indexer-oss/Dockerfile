# syntax=docker/dockerfile:1.7
FROM rust:1.82-slim-bookworm AS builder
WORKDIR /build
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && echo 'fn main() {}' > src/main.rs && echo '' > src/lib.rs && cargo fetch --locked
COPY . .
RUN --mount=type=cache,target=/build/target,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    cargo build --release --locked --bin rgbpp-indexer && \
    cp /build/target/release/rgbpp-indexer /app-bin && \
    strip /app-bin

FROM debian:bookworm-slim AS runtime
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --home /app --shell /usr/sbin/nologin svc
WORKDIR /app
USER svc:svc
COPY --from=builder --chown=svc:svc /app-bin /usr/local/bin/rgbpp-indexer
EXPOSE 8114
ENTRYPOINT ["rgbpp-indexer"]
