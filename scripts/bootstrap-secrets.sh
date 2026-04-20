#!/usr/bin/env bash
# Bootstrap the two services' required Secrets in a Kubernetes
# namespace.  For dev / staging — in production you MUST come
# from Vault / HSM / SealedSecrets / External Secrets Operator.
#
# Generates:
#   * JWT_SECRET               (32 bytes, openssl rand)
#   * KEYBLOB_ENCRYPTION_KEY   (32 bytes, openssl rand)
#
# Must be provided by the caller (refuse to proceed without):
#   * DATABASE_URL             (DB credentials)
#   * REDIS_URL                (Redis credentials)
#   * RELAYER_PRIVATE_KEY      (relayer EOA — hex, 0x-prefixed)
#   * FARM_ADMIN_ADDRESSES     (CKB addresses, comma-sep)
#   * FARM_ADMIN_PUBKEYS       (secp256k1 pubkeys hex, comma-sep)
#
# Usage:
#   export DATABASE_URL='mysql://...'
#   export REDIS_URL='redis://...'
#   export RELAYER_PRIVATE_KEY='0x...'
#   export FARM_ADMIN_ADDRESSES='ckb1...,ckb1...'
#   export FARM_ADMIN_PUBKEYS='02ab...,03cd...'
#   ./scripts/bootstrap-secrets.sh [--namespace huehub-backend] [--dry-run]
#
# Safety: re-running OVERWRITES any existing Secret with the same
# name, which will rotate JWT_SECRET and break all active admin
# sessions.  Passes --dry-run=client by default; add --apply to
# actually create.

set -euo pipefail

NAMESPACE="huehub-backend"
APPLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    --dry-run) APPLY=0; shift ;;
    -h|--help) head -n 30 "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

require() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: environment variable '${var}' must be set." >&2
    echo "  see header of $0 for the full list." >&2
    exit 2
  fi
}
require DATABASE_URL
require REDIS_URL
require RELAYER_PRIVATE_KEY
require FARM_ADMIN_ADDRESSES
require FARM_ADMIN_PUBKEYS

# Lightly validate the relayer private key shape — 0x-prefixed,
# 64 hex chars.  We refuse obvious mistakes like "0x" + an
# ENV var name that didn't expand.
if ! [[ "$RELAYER_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "ERROR: RELAYER_PRIVATE_KEY must be 0x + 64 hex chars" >&2
  exit 2
fi

JWT_SECRET="$(openssl rand -hex 32)"
KEYBLOB_ENCRYPTION_KEY="$(openssl rand -hex 32)"

echo "==> generated JWT_SECRET         (32 bytes)"
echo "==> generated KEYBLOB_ENCRYPTION_KEY  (32 bytes)"
echo "==> namespace: ${NAMESPACE}"
if [[ $APPLY -eq 0 ]]; then
  echo "==> DRY RUN (pass --apply to actually create Secrets)"
fi

# Use kubectl apply --dry-run=client so we can see the
# rendered YAML without actually creating anything.
apply_cmd() {
  if [[ $APPLY -eq 1 ]]; then
    kubectl apply -n "$NAMESPACE" -f -
  else
    kubectl apply -n "$NAMESPACE" --dry-run=client -o yaml -f -
  fi
}

cat <<EOF | apply_cmd
---
apiVersion: v1
kind: Secret
metadata:
  name: farm-sequencer-secrets
type: Opaque
stringData:
  DATABASE_URL: "${DATABASE_URL}"
  REDIS_URL: "${REDIS_URL}"
  JWT_SECRET: "${JWT_SECRET}"
  FARM_ADMIN_ADDRESSES: "${FARM_ADMIN_ADDRESSES}"
  FARM_ADMIN_PUBKEYS: "${FARM_ADMIN_PUBKEYS}"
EOF

cat <<EOF | apply_cmd
---
apiVersion: v1
kind: Secret
metadata:
  name: relayer-secrets
type: Opaque
stringData:
  DATABASE_URL: "${DATABASE_URL}"
  REDIS_URL: "${REDIS_URL}"
  JWT_SECRET: "${JWT_SECRET}"
  KEYBLOB_ENCRYPTION_KEY: "${KEYBLOB_ENCRYPTION_KEY}"
  RELAYER_PRIVATE_KEY: "${RELAYER_PRIVATE_KEY}"
EOF

cat <<'POSTFIX'

NEXT STEPS FOR PRODUCTION:
  * Do NOT commit any of these values.  Put them in Vault or
    your cloud's Secrets Manager; use ESO / External Secrets
    Operator / vault-agent-injector to sync into the pod.
  * Rotate JWT_SECRET on a schedule (recommended: 90 days).
  * The RELAYER_PRIVATE_KEY should ultimately live behind an
    HSM or MPC (Fireblocks / Turnkey / ZenGo).  Have the app
    request sign operations via API instead of reading the
    raw key.  See deploy/vault/policies.hcl for the
    vault-transit path this maps to.
POSTFIX
