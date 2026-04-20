#!/usr/bin/env bash
# One-shot deployment rehearsal for the 6 fund-critical services.
#
# What it does (idempotent — safe to re-run):
#   1. Verify docker daemon is reachable.
#   2. Ensure `docker compose` v2 is available; install to
#      ~/.docker/cli-plugins/ (no sudo) if missing.
#   3. Create .env.integration (if absent) with freshly-generated
#      secrets for every `openssl rand -hex 32` field.
#   4. Bring up mysql + redis; wait until both report (healthy).
#   5. Build + bring up the 6 app services.
#   6. Poll each service's /health for up to 180 s; print a pass/fail
#      table at the end.
#
# Usage:
#   bash scripts/rehearsal-up.sh
#
# Tear down:
#   bash scripts/rehearsal-down.sh

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="docker-compose.integration.yml"
ENV_FILE=".env.integration"
ENV_TEMPLATE="docs/env.integration.example"
COMPOSE_VERSION="v2.29.7"

log()  { printf '\033[1;36m[rehearsal]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[rehearsal]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[rehearsal]\033[0m %s\n' "$*" >&2; exit 1; }

# ── 1. docker daemon reachable ───────────────────────────────────────
if ! command -v docker >/dev/null; then
  die "docker not installed. Install docker.io first."
fi
if ! docker info >/dev/null 2>&1; then
  die "docker daemon not reachable. Either start it (sudo systemctl start docker) or add your user to the 'docker' group."
fi
log "docker daemon reachable"

# ── 2. docker compose v2 present ─────────────────────────────────────
if ! docker compose version >/dev/null 2>&1; then
  log "installing docker compose ${COMPOSE_VERSION} to ~/.docker/cli-plugins/"
  mkdir -p "$HOME/.docker/cli-plugins"
  curl -fsSL \
    -o "$HOME/.docker/cli-plugins/docker-compose" \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64"
  chmod +x "$HOME/.docker/cli-plugins/docker-compose"
  docker compose version >/dev/null || die "compose install failed"
fi
log "compose: $(docker compose version --short)"

# ── 3. .env.integration ──────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  [[ -f "$ENV_TEMPLATE" ]] || die "missing $ENV_TEMPLATE"
  cp "$ENV_TEMPLATE" "$ENV_FILE"
  log "created $ENV_FILE from template; filling secrets…"
  python3 - "$ENV_FILE" <<'PY'
import secrets, re, sys, pathlib
p = pathlib.Path(sys.argv[1])
t = p.read_text()
fields = [
    "MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD",
    "JWT_SECRET", "KEYBLOB_ENCRYPTION_KEY",
    "RELAYER_PRIVATE_KEY", "RELAYER_API_KEY",
    "FARM_API_KEY", "DISTRIBUTOR_API_KEY",
    "DISTRIBUTOR_PRIVATE_KEY",
]
for k in fields:
    # Only fill if the line is empty (`K=`) — never overwrite a user value.
    t = re.sub(rf"^{k}=\s*$", f"{k}={secrets.token_hex(32)}", t, flags=re.MULTILINE)
p.write_text(t)
print(f"  filled {len(fields)} fields")
PY
else
  log "$ENV_FILE already exists; leaving it alone"
fi

# ── 4. infra: mysql + redis ─────────────────────────────────────────
log "bringing up mysql + redis…"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d mysql redis

log "waiting for infra healthchecks (up to 60 s)…"
deadline=$(( $(date +%s) + 60 ))
while :; do
  ids=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q mysql redis)
  ready=$(docker inspect -f '{{.State.Health.Status}}' $ids 2>/dev/null | grep -c '^healthy$' || true)
  if [[ "$ready" == "2" ]]; then
    log "infra healthy"
    break
  fi
  (( $(date +%s) >= deadline )) && die "infra not healthy after 60 s; check: docker compose logs mysql redis"
  sleep 3
done

# ── 5. build + up the apps ───────────────────────────────────────────
log "building and starting the 6 app services (first run ~8-15 min)…"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up --build -d \
  btc-assets-api solagram-backend mystery-bomb-box-backend \
  unipass-wallet-relayer utxoswap-farm-sequencer huehub-token-distributor

# ── 6. poll /health on each app ──────────────────────────────────────
declare -A PORTS=(
  [btc-assets-api]=3000
  [solagram-backend]=3001
  [mystery-bomb-box-backend]=3002
  [unipass-wallet-relayer]=8085
  [utxoswap-farm-sequencer]=8086
  [huehub-token-distributor]=8087
)

log "probing /health on each service (up to 180 s)…"
deadline=$(( $(date +%s) + 180 ))
declare -A STATUS
while (( $(date +%s) < deadline )); do
  all_ok=1
  for svc in "${!PORTS[@]}"; do
    [[ "${STATUS[$svc]:-}" == "ok" ]] && continue
    if curl -sf "http://127.0.0.1:${PORTS[$svc]}/health" -o /dev/null 2>/dev/null; then
      STATUS[$svc]=ok
    else
      STATUS[$svc]=wait
      all_ok=0
    fi
  done
  (( all_ok )) && break
  sleep 4
done

# ── 7. summary ──────────────────────────────────────────────────────
echo
printf '%-30s %-6s %-6s\n' "SERVICE" "PORT" "HEALTH"
printf '%-30s %-6s %-6s\n' "------------------------------" "------" "------"
fail=0
for svc in "${!PORTS[@]}"; do
  state="${STATUS[$svc]:-unknown}"
  if [[ "$state" == "ok" ]]; then
    printf '%-30s %-6s \033[1;32mOK\033[0m\n' "$svc" "${PORTS[$svc]}"
  else
    printf '%-30s %-6s \033[1;31mFAIL\033[0m\n' "$svc" "${PORTS[$svc]}"
    fail=1
  fi
done

echo
if (( fail )); then
  warn "some services failed /health — inspect logs with:"
  warn "  docker compose -f $COMPOSE_FILE logs --tail 50 <service-name>"
  exit 1
fi

log "all 6 services green. extra probes:"
for port in 8085 8086; do
  printf '  readyz (%s) → ' "$port"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:${port}/readyz" || echo "unreachable"
done
log "rehearsal complete. tear down with: bash scripts/rehearsal-down.sh"
