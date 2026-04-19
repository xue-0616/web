#!/usr/bin/env bash
# Greenfield build for unipass-wallet-official-website-oss. Installs deps + runs the stack's default build.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile && pnpm build
elif [[ -f yarn.lock ]]; then
  yarn install --frozen-lockfile && yarn build
else
  npm install
  npm run build
fi
echo "✓ unipass-wallet-official-website-oss built → $ROOT/dist"
