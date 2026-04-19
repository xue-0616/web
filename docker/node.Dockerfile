# ------------------------------------------------------------------
# Generic multi-stage Dockerfile for NestJS / Node.js backend services
#
# Build args:
#   APP_DIR   – directory name under backend-node/ (e.g. dexauto-server)
#   START_CMD – production entrypoint (default: node dist/main.js)
#   PORT      – container port (default: 3000)
#
# Usage:
#   docker build \
#     --build-arg APP_DIR=dexauto-server \
#     --build-arg START_CMD="node dist/src/main" \
#     -f docker/node.Dockerfile \
#     -t dexauto-server:latest \
#     backend-node/dexauto-server
# ------------------------------------------------------------------

# ---- Stage 1: install + build ----
FROM node:20-slim AS builder
ARG APP_DIR
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY . .
RUN npm run build

# ---- Stage 2: production image ----
FROM node:20-slim
ARG START_CMD="node dist/main.js"
ARG PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=${PORT}
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -sf http://localhost:${PORT}/health || exit 1

CMD ${START_CMD}
