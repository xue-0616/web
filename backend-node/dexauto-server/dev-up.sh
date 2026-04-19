#!/usr/bin/env bash
# Bring up postgres + redis + clickhouse for local dev.
# Uses plain `docker run` so no docker-compose plugin is required.
#
# Idempotent: safe to re-run — existing containers are left alone if already
# healthy, and recreated if present-but-dead.
#
# Pairs with `dev.env` + `dev.secret.json` (default credentials: dexauto/dexauto).
set -euo pipefail

NET=dexauto-dev

# Create the network (ignore "already exists").
docker network create "$NET" >/dev/null 2>&1 || true

# Start a container only if it's not already running. If it's stopped,
# remove it and recreate.
start() {
  local name="$1"; shift
  if docker ps --format '{{.Names}}' | grep -Fxq "$name"; then
    echo "  ✓ $name already running"
    return 0
  fi
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$name"; then
    docker rm -f "$name" >/dev/null
  fi
  echo "  ▶ starting $name …"
  docker run -d --name "$name" --network "$NET" --restart unless-stopped "$@" >/dev/null
}

# -------- PostgreSQL 16 --------
start dexauto-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=dexauto \
  -e POSTGRES_PASSWORD=dexauto \
  -e POSTGRES_DB=dexauto \
  -v dexauto-pg-data:/var/lib/postgresql/data \
  postgres:16-alpine

# -------- Redis 7 (no TLS, no password — dev only) --------
start dexauto-redis \
  -p 6379:6379 \
  -v dexauto-redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes

# -------- ClickHouse 24 --------
start dexauto-clickhouse \
  -p 8123:8123 -p 9000:9000 \
  --ulimit nofile=262144:262144 \
  -e CLICKHOUSE_DB=default \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD= \
  -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
  -v dexauto-ch-data:/var/lib/clickhouse \
  clickhouse/clickhouse-server:24-alpine

# -------- Readiness wait --------
echo
echo "Waiting for services to become reachable …"
for i in {1..30}; do
  pg_ready=$(docker exec dexauto-postgres pg_isready -U dexauto 2>&1 | grep -c 'accepting' || true)
  redis_ready=$(docker exec dexauto-redis redis-cli ping 2>&1 | grep -c 'PONG' || true)
  ch_ready=$(curl -sf http://127.0.0.1:8123/ping 2>/dev/null | grep -c 'Ok' || true)
  if [[ "$pg_ready" == "1" && "$redis_ready" == "1" && "$ch_ready" == "1" ]]; then
    echo "  ✓ postgres/redis/clickhouse all ready"
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "  ✗ timed out waiting for services"
    docker ps -a --filter "network=$NET"
    exit 1
  fi
done

echo
echo "All services up. Connection info:"
echo "  postgres:   postgres://dexauto:dexauto@127.0.0.1:5432/dexauto"
echo "  redis:      redis://127.0.0.1:6379"
echo "  clickhouse: http://127.0.0.1:8123  (user=default, no password)"
