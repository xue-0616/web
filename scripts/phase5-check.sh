#!/usr/bin/env bash
# Phase 5 sanity check — confirm every frontend/*-oss has a matching
# upstream directory that is itself a buildable package.
#
# Does NOT run `npm install` (that's Track D / per-PR CI).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Mapping — keep in sync with frontend/PHASE_5_MAP.md.
declare -a MAP=(
  "payment-specifications-oss|UniPass-Wallet-Docs"
  "payment-swagger-oss|UniPass-Wallet-Docs"
  "solana-wallet-mini-app-demo-oss|smart-account-vite-demo"
  "unipass-app-h5-oss|unipass-frontend-test"
  "unipass-snap-frontend-oss|UniPass-Snap"
  "unipass-snap-react-oss|UniPass-Wallet-Snap"
  "unipass-wallet-js-oss|UniPass-Wallet-JS"
  "utxo-swap-site-oss|utxo-stack-sdk"
)

fail=0
total=${#MAP[@]}
ok=0

for entry in "${MAP[@]}"; do
  oss_dir="${entry%%|*}"
  upstream="${entry##*|}"
  oss_path="$ROOT/frontend/$oss_dir"
  up_path="$ROOT/upstream/$upstream"

  # 1. oss dir exists and has required files
  for required in README.md UPSTREAM scripts/build.sh; do
    if [[ ! -f "$oss_path/$required" ]]; then
      echo "✗ $oss_dir: missing $required"
      fail=$((fail + 1))
      continue 2
    fi
  done
  if [[ ! -x "$oss_path/scripts/build.sh" ]]; then
    echo "✗ $oss_dir: scripts/build.sh not executable"
    fail=$((fail + 1))
    continue
  fi

  # 2. upstream exists and has a build manifest
  if [[ ! -d "$up_path" ]]; then
    echo "✗ $oss_dir → missing upstream $upstream"
    fail=$((fail + 1))
    continue
  fi
  has_manifest=0
  for m in package.json docusaurus.config.js vite.config.ts vite.config.js pnpm-workspace.yaml index.html; do
    if [[ -e "$up_path/$m" ]]; then
      has_manifest=1
      break
    fi
  done
  if [[ "$has_manifest" -eq 0 ]]; then
    echo "✗ $oss_dir → upstream $upstream has no recognised build manifest"
    fail=$((fail + 1))
    continue
  fi

  echo "✓ $oss_dir ← upstream/$upstream"
  ok=$((ok + 1))
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$fail" -eq 0 ]]; then
  echo "Phase 5: all $total mappings present."
  exit 0
else
  echo "Phase 5: $ok/$total OK, $fail failure(s)."
  exit 1
fi
