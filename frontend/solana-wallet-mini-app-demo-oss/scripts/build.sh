#!/usr/bin/env bash
# Auto-generated Phase 5 build wrapper for `solana-wallet-mini-app-demo-oss`.
# Upstream: upstream/smart-account-vite-demo
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
UPSTREAM="$ROOT/upstream/smart-account-vite-demo"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist"

if [[ ! -d "$UPSTREAM" ]]; then
  echo "ERROR: upstream not found at $UPSTREAM" >&2
  exit 1
fi

pushd "$UPSTREAM" >/dev/null
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile && pnpm build
elif [[ -f yarn.lock ]]; then
  yarn install --frozen-lockfile && yarn build
else
  npm ci && npm run build
fi
popd >/dev/null
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$UPSTREAM/dist/." "$OUT/"

echo "✓ solana-wallet-mini-app-demo-oss → $OUT"
