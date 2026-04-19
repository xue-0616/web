# syntax=docker/dockerfile:1.7

FROM rust:1.82-slim-bookworm AS builder
WORKDIR /build

# Deps-only precompile layer for reuse.
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src migrations \
 && echo 'fn main() {}' > src/main.rs \
 && echo '' > src/lib.rs \
 && cargo fetch --locked
COPY . .

RUN --mount=type=cache,target=/build/target,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    cargo build --release --locked --bin asset-migrator && \
    cp /build/target/release/asset-migrator /asset-migrator && \
    strip /asset-migrator

FROM debian:bookworm-slim AS runtime
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --home /app --shell /usr/sbin/nologin svc

WORKDIR /app
USER svc:svc
ENV LOG_OUTPUT_FORMAT=json

COPY --from=builder --chown=svc:svc /asset-migrator /usr/local/bin/asset-migrator
COPY --chown=svc:svc migrations /app/migrations

EXPOSE 8080
ENTRYPOINT ["asset-migrator"]
