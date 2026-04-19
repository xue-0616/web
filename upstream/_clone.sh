#!/usr/bin/env bash
# Shallow-clone (depth=1) all unique upstream repos into upstream/<repo-name>/
set -u
cd "$(dirname "$0")"

REPOS=(
  "https://github.com/UniPassID/UniPass-OpenID-Auth.git"
  "https://github.com/utxostack/utxo-allocator.git"
  "https://github.com/utxostack/rgbpp.git"
  "https://github.com/UniPassID/account-abstraction.git"
  "https://github.com/UniPassID/stackup-bundler.git"
  "https://github.com/UniPassID/UniPass-Snap.git"
  "https://github.com/UniPassID/UniPass-Tss-Lib.git"
  "https://github.com/UniPassID/UniPass-email-circuits.git"
  "https://github.com/UniPassID/UniPass-Wallet-Docs.git"
  "https://github.com/UniPassID/smart-account-vite-demo.git"
  "https://github.com/UniPassID/unipass-frontend-test.git"
  "https://github.com/UniPassID/UniPass-Wallet-Snap.git"
  "https://github.com/UniPassID/UniPass-Wallet-JS.git"
  "https://github.com/utxostack/utxo-stack-sdk.git"
  # HueHub-related open-source components discovered via binary analysis
  "https://github.com/streamingfast/substreams-sink-sql.git"
  "https://github.com/streamingfast/solana-token-tracker.git"
  "https://github.com/Topledger/solana-programs.git"
)

> _clone.log
clone_one() {
  local url="$1"
  local name; name=$(basename "$url" .git)
  if [ -d "$name/.git" ]; then
    echo "[skip-exist] $name" | tee -a _clone.log
    return 0
  fi
  if git clone --depth 1 --quiet --no-tags "$url" "$name" 2>>_clone.log; then
    echo "[ok] $name" | tee -a _clone.log
  else
    echo "[FAIL] $name ($url)" | tee -a _clone.log
  fi
}

# Run up to 4 in parallel
export -f clone_one
printf '%s\n' "${REPOS[@]}" | xargs -n1 -P4 -I{} bash -c 'clone_one "$@"' _ {}

echo
echo "=== Summary ==="
grep -E '^\[ok\]|^\[FAIL\]|^\[skip-exist\]' _clone.log | sort | uniq -c | sort -rn
