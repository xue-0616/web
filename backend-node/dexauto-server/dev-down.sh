#!/usr/bin/env bash
# Tear down the dev stack. By default preserves volumes so data survives.
# Pass --purge to wipe volumes too.
set -euo pipefail

for name in dexauto-postgres dexauto-redis dexauto-clickhouse; do
  docker rm -f "$name" >/dev/null 2>&1 && echo "  ✓ removed $name" || echo "  · $name not running"
done

docker network rm dexauto-dev >/dev/null 2>&1 || true

if [[ "${1:-}" == "--purge" ]]; then
  docker volume rm dexauto-pg-data dexauto-redis-data dexauto-ch-data 2>/dev/null || true
  echo "  ✓ volumes wiped"
fi
