#!/usr/bin/env bash
# Auto-generated Phase 5 build wrapper for `unipass-snap-react-oss`.
# Upstream: upstream/UniPass-Wallet-Snap
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
UPSTREAM="$ROOT/upstream/UniPass-Wallet-Snap"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist"

if [[ ! -d "$UPSTREAM" ]]; then
  echo "ERROR: upstream not found at $UPSTREAM" >&2
  exit 1
fi

pushd "$UPSTREAM" >/dev/null
npm ci
npm run build --workspaces --if-present
popd >/dev/null
rm -rf "$OUT"; mkdir -p "$OUT"
echo "Build complete; inspect $UPSTREAM/packages/*/dist or build/ for artefacts" | tee "$OUT/BUILD_NOTES.txt"

echo "✓ unipass-snap-react-oss → $OUT"
