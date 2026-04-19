#!/usr/bin/env bash
# Auto-generated Phase 5 build wrapper for `unipass-app-h5-oss`.
# Upstream: upstream/unipass-frontend-test
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
UPSTREAM="$ROOT/upstream/unipass-frontend-test"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist"

if [[ ! -d "$UPSTREAM" ]]; then
  echo "ERROR: upstream not found at $UPSTREAM" >&2
  exit 1
fi

# Upstream is a static demo — just copy.
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$UPSTREAM/." "$OUT/"
echo "NOTE: upstream is a placeholder; real app must be rebuilt in Phase 6" >&2

echo "✓ unipass-app-h5-oss → $OUT"
