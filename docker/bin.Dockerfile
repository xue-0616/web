# ------------------------------------------------------------------
# Dockerfile for backend-bin precompiled ELF services
#
# These are already-compiled binaries extracted from original Docker
# layers. No source build — just copy the binary in.
#
# Build args:
#   BIN_FILE  – binary filename inside the context (e.g. trading-tracker)
#   PORT      – container port (default: 8080)
#
# Usage:
#   docker build \
#     --build-arg BIN_FILE=trading-tracker \
#     -f docker/bin.Dockerfile \
#     -t trading-tracker:latest \
#     backend-bin/trading-tracker
# ------------------------------------------------------------------

FROM debian:12-slim
ARG BIN_FILE
ARG PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libgcc-s1 curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY ${BIN_FILE} /app/${BIN_FILE}
COPY wrapper.sh /app/wrapper.sh 2>/dev/null || true
RUN chmod +x /app/${BIN_FILE} /app/wrapper.sh 2>/dev/null || chmod +x /app/${BIN_FILE}

ENV PORT=${PORT}
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD curl -sf http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/app/${BIN_FILE}"]
