# syntax=docker/dockerfile:1.7
# NestJS 10 backend for Solagram — builds dist/src/main.js and runs it.

FROM node:20-slim AS builder
WORKDIR /app

# husky's `prepare` script is skipped in production install (no .git).
ENV HUSKY=0

COPY package.json package-lock.json* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile --ignore-scripts; \
    else npm install --ignore-scripts; fi

COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production \
    HUSKY=0 \
    PORT=3001
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --home /app --shell /usr/sbin/nologin svc

COPY --from=builder --chown=svc:svc /app/dist ./dist
COPY --from=builder --chown=svc:svc /app/node_modules ./node_modules
COPY --from=builder --chown=svc:svc /app/package.json ./

USER svc:svc
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -sf "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/src/main.js"]
