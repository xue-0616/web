#!/usr/bin/env bash
# Phase 6 sanity check — every greenfield scaffold has the required
# structure (package.json, README, UPSTREAM, scripts/build.sh),
# and its package.json parses as valid JSON with a non-empty name.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

declare -a SCAFFOLDS=(
  "unipass-auth0-verify-code-oss"
  "unipass-cms-frontend-oss"
  "unipass-payment-web-oss"
  "unipass-wallet-frontend-oss"
  "unipass-wallet-official-website-oss"
)

fail=0
total=${#SCAFFOLDS[@]}
ok=0

for name in "${SCAFFOLDS[@]}"; do
  base="$ROOT/frontend/$name"
  for f in README.md UPSTREAM package.json scripts/build.sh; do
    if [[ ! -e "$base/$f" ]]; then
      echo "✗ $name: missing $f"
      fail=$((fail + 1))
      continue 2
    fi
  done
  if [[ ! -x "$base/scripts/build.sh" ]]; then
    echo "✗ $name: scripts/build.sh not executable"
    fail=$((fail + 1))
    continue
  fi
  # Validate package.json
  if ! python3 -c "
import json, sys
p = json.load(open('$base/package.json'))
assert p.get('name'), 'empty name'
assert p.get('scripts', {}).get('build'), 'no build script'
" > /dev/null 2>&1; then
    echo "✗ $name: invalid package.json (missing name or build script)"
    fail=$((fail + 1))
    continue
  fi
  echo "✓ $name"
  ok=$((ok + 1))
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$fail" -eq 0 ]]; then
  echo "Phase 6: all $total scaffolds present."
  exit 0
else
  echo "Phase 6: $ok/$total OK, $fail failure(s)."
  exit 1
fi
