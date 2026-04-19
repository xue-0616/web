#!/usr/bin/env bash
# Auto-generated Phase 5 build wrapper for `unipass-snap-frontend-oss`.
# Upstream: upstream/UniPass-Snap
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
UPSTREAM="$ROOT/upstream/UniPass-Snap"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist"

if [[ ! -d "$UPSTREAM" ]]; then
  echo "ERROR: upstream not found at $UPSTREAM" >&2
  exit 1
fi

pushd "$UPSTREAM" >/dev/null
yarn install --frozen-lockfile
yarn build
popd >/dev/null
# Output layout is monorepo-specific; check README for exact artefacts.
rm -rf "$OUT"; mkdir -p "$OUT"
echo "Build complete; inspect $UPSTREAM/packages/*/out or build/ for artefacts" | tee "$OUT/BUILD_NOTES.txt"

echo "✓ unipass-snap-frontend-oss → $OUT"
