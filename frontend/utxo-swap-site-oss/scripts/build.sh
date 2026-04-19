#!/usr/bin/env bash
# Auto-generated Phase 5 build wrapper for `utxo-swap-site-oss`.
# Upstream: upstream/utxo-stack-sdk
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
UPSTREAM="$ROOT/upstream/utxo-stack-sdk"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist"

if [[ ! -d "$UPSTREAM" ]]; then
  echo "ERROR: upstream not found at $UPSTREAM" >&2
  exit 1
fi

pushd "$UPSTREAM" >/dev/null
pnpm install --frozen-lockfile
pnpm -r build
popd >/dev/null
rm -rf "$OUT"; mkdir -p "$OUT"
echo "Build complete; SDK packages are under $UPSTREAM/packages/*/dist (consumed via workspace)" | tee "$OUT/BUILD_NOTES.txt"

echo "✓ utxo-swap-site-oss → $OUT"
