#!/usr/bin/env bash
# Phase 7 sanity check — 6 greenfield scaffolds for HueHub / Solagram /
# Bomb.fun. Intentionally excludes `hongkong-wanxiang-festival`, which
# the master plan marks as a stale event page (deleted, not rewritten).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

declare -a SCAFFOLDS=(
  "auto-dex-site-oss"
  "huehub-dex-site-oss"
  "bomb-fun-site-oss"
  "solagram-wallet-oss"
  "solagram-web-site-oss"
  "blinks-miniapp-oss"
)

fail=0
total=${#SCAFFOLDS[@]}
ok=0

for name in "${SCAFFOLDS[@]}"; do
  base="$ROOT/frontend/$name"
  for f in README.md UPSTREAM package.json scripts/build.sh; do
    if [[ ! -e "$base/$f" ]]; then
      echo "X $name: missing $f"
      fail=$((fail + 1))
      continue 2
    fi
  done
  if [[ ! -x "$base/scripts/build.sh" ]]; then
    echo "X $name: scripts/build.sh not executable"
    fail=$((fail + 1))
    continue
  fi
  if ! python3 -c "
import json, sys
p = json.load(open('$base/package.json'))
assert p.get('name'), 'empty name'
assert p.get('scripts', {}).get('build'), 'no build script'
" > /dev/null 2>&1; then
    echo "X $name: invalid package.json"
    fail=$((fail + 1))
    continue
  fi
  echo "OK $name"
  ok=$((ok + 1))
done

echo ""
echo "--------------------------------"
if [[ "$fail" -eq 0 ]]; then
  echo "Phase 7: all $total scaffolds present."
  exit 0
else
  echo "Phase 7: $ok/$total OK, $fail failure(s)."
  exit 1
fi
