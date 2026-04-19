# ------------------------------------------------------------------
# Generic multi-stage Dockerfile for Rust backend services
#
# Build args:
#   BIN_NAME  – cargo binary name (e.g. payment-server)
#   PORT      – container port (default: 8080)
#
# Usage:
#   docker build \
#     --build-arg BIN_NAME=payment-server \
#     -f docker/rust.Dockerfile \
#     -t payment-server:latest \
#     backend-rust/payment-server
# ------------------------------------------------------------------

# ---- Stage 1: build ----
FROM rust:1.78-slim-bookworm AS builder
ARG BIN_NAME
WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY . .
RUN cargo build --release

# ---- Stage 2: production image ----
FROM debian:bookworm-slim
ARG BIN_NAME
ARG PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 libgcc-s1 curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/${BIN_NAME} /app/${BIN_NAME}

ENV PORT=${PORT}
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -sf http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/app/${BIN_NAME}"]
