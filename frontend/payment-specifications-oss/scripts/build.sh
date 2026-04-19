#!/usr/bin/env bash
# Build the payment-specifications site by delegating to the upstream
# Docusaurus project. Output is copied back into this directory's
# `dist/` so that downstream (e.g. Nginx container) can consume a
# predictable path.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UPSTREAM="$ROOT/upstream/UniPass-Wallet-Docs"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist"

if [[ ! -d "$UPSTREAM" ]]; then
  echo "ERROR: upstream not found at $UPSTREAM" >&2
  exit 1
fi

pushd "$UPSTREAM" >/dev/null
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
  pnpm build
elif [[ -f yarn.lock ]]; then
  yarn install --frozen-lockfile
  yarn build
else
  npm ci
  npm run build
fi
popd >/dev/null

rm -rf "$OUT"
mkdir -p "$OUT"
cp -r "$UPSTREAM/build/." "$OUT/"
echo "✓ built → $OUT"
