#!/usr/bin/env bash
# Tear down the integration rehearsal stack.
#
# Usage:
#   bash scripts/rehearsal-down.sh          # stop containers, keep data
#   bash scripts/rehearsal-down.sh --wipe   # also delete ./data/mysql, ./data/redis

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="docker-compose.integration.yml"
ENV_FILE=".env.integration"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

if [[ "${1:-}" == "--wipe" ]]; then
  echo "[rehearsal] wiping ./data/mysql and ./data/redis…"
  rm -rf ./data/mysql ./data/redis
fi

echo "[rehearsal] stack stopped."
