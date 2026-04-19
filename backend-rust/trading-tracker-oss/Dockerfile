# syntax=docker/dockerfile:1.7

# ───────────────────────────────────────────────────────────────────────────
# Stage 1 — builder
# ───────────────────────────────────────────────────────────────────────────
# Use the official rust image pinned to a minor version so cache keys are
# stable. `slim` drops the build-essential stuff we'd otherwise just pay for
# in disk bytes; we add only what the build actually needs.
FROM rust:1.82-slim-bookworm AS builder

# System deps:
#   * `pkg-config` + `libssl-dev`  — tonic's TLS stack (hyper-rustls backend
#                                    still links to the system OpenSSL in
#                                    its build scripts when the default
#                                    features cascade pulls it in).
#   * `ca-certificates`            — protoc-bin-vendored doesn't need these
#                                    but the eventual gRPC TLS client does;
#                                    we copy them into the runtime image too.
#   * `build-essential`            — C compiler for native deps (rust-rocksdb
#                                    and friends pulled in transitively by
#                                    some solana crates).
# `--mount=type=cache` keeps the apt lists across builds; useful for CI.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        pkg-config libssl-dev ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy only the manifest + lockfile first so layer caching works: if no
# deps changed, cargo fetches nothing.
COPY Cargo.toml Cargo.lock* ./
COPY build.rs build.rs
# The proto tree is an input to `build.rs`; include it in the deps layer
# so re-runs of `cargo fetch` don't bust when only .rs files change.
COPY proto ./proto

# Create a stub so `cargo fetch` sees a valid crate graph without copying
# src yet — this is the "precache dependencies" trick.
RUN mkdir -p src && \
    echo 'fn main() {}' > src/main.rs && \
    echo '' > src/lib.rs && \
    cargo fetch --locked

# Now bring in the real source and build.
COPY src ./src
COPY tests ./tests

# Release build with incremental off — reproducible-ish artefact. Skip
# running tests here; CI handles that separately in parallel jobs.
RUN --mount=type=cache,target=/build/target,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    cargo build --release --locked --bin trading-tracker && \
    # Copy out of the cache mount (mount is ephemeral for the next RUN).
    cp /build/target/release/trading-tracker /trading-tracker && \
    strip /trading-tracker

# ───────────────────────────────────────────────────────────────────────────
# Stage 2 — runtime
# ───────────────────────────────────────────────────────────────────────────
# `debian:bookworm-slim` (~30 MB) over `distroless/cc` (also ~25 MB) because
# it still ships `sh` and `curl`, which are invaluable when debugging why
# a pod can't reach its substreams endpoint. If size matters more than
# debuggability, swap the base for `gcr.io/distroless/cc-debian12`.
FROM debian:bookworm-slim AS runtime

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --home /app --shell /usr/sbin/nologin tracker

WORKDIR /app
USER tracker:tracker

# Persistent cursor DB lives here. Mount a volume over it in production.
ENV TRADING_TRACKER_DB_PATH=/app/data/cursor.redb \
    TRADING_TRACKER_LOG_OUTPUT_FORMAT=json \
    TRADING_TRACKER_RPC_LISTEN_ADDR=0.0.0.0:8080
RUN mkdir -p /app/data || true

COPY --from=builder --chown=tracker:tracker /trading-tracker /usr/local/bin/trading-tracker

# Default RPC port, override via TRADING_TRACKER_RPC_LISTEN_ADDR or config.toml.
EXPOSE 8080

# TCP liveness — the JSON-RPC server accepts connections as soon as it binds,
# before the substreams consumer has caught up. That's the right "alive"
# semantic: readiness should be a separate k8s probe that checks whether
# the cursor is advancing.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS -o /dev/null http://localhost:8080/ || exit 1

ENTRYPOINT ["trading-tracker"]
