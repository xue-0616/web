#!/usr/bin/env bash
# Build all Docker images in the project.
# Usage:  ./docker/build-all.sh [--push REGISTRY]
set -euo pipefail
cd "$(dirname "$0")/.."

REGISTRY="${1:-}"
TAG="${TAG:-latest}"

log() { echo -e "\033[1;34m▶ $*\033[0m"; }
err() { echo -e "\033[1;31m✗ $*\033[0m" >&2; }

build_node() {
  local dir=$1 start_cmd=$2 port=${3:-3000}
  local name=$(basename "$dir")
  log "Building node/$name"
  docker build \
    --build-arg START_CMD="$start_cmd" \
    --build-arg PORT="$port" \
    -f docker/node.Dockerfile \
    -t "${name}:${TAG}" \
    "$dir"
}

build_rust() {
  local dir=$1 bin_name=$2 port=${3:-8080}
  local name=$(basename "$dir")
  log "Building rust/$name"
  docker build \
    --build-arg BIN_NAME="$bin_name" \
    --build-arg PORT="$port" \
    -f docker/rust.Dockerfile \
    -t "${name}:${TAG}" \
    "$dir"
}

build_bin() {
  local dir=$1 bin_file=$2 port=${3:-8080}
  local name=$(basename "$dir")
  log "Building bin/$name"
  docker build \
    --build-arg BIN_FILE="$bin_file" \
    --build-arg PORT="$port" \
    -f docker/bin.Dockerfile \
    -t "${name}:${TAG}" \
    "$dir"
}

# ─── backend-node ────────────────────────────────────────────────
build_node backend-node/dexauto-server           "node dist/src/main"   3000
build_node backend-node/huehub-dex-backend       "node dist/main"       3000
build_node backend-node/huehub-dex-dobs-backend  "node dist/main"       3000
build_node backend-node/mystery-bomb-box-backend "node dist/src/main"   3000
build_node backend-node/opentg-backend           "node dist/main"       3000
build_node backend-node/solagram-backend         "node dist/src/main"   3000
build_node backend-node/unipass-activity-backend "node dist/main.js"    3000
build_node backend-node/unipass-cms-backend      "node dist/main.js"    3000
build_node backend-node/unipass-wallet-backend   "node dist/main.js"    3000
build_node backend-node/unipass-wallet-custom    "node dist/main.js"    3000
build_node backend-node/unipass-wallet-extend    "node dist/main"       3000
build_node backend-node/unipass-wallet-oauth     "node dist/main.js"    3000
build_node backend-node/utxoswap-paymaster-backend "node dist/main"     3000

# ─── backend-rust ────────────────────────────────────────────────
build_rust backend-rust/dexauto-trading-server   dexauto-trading-server   8080
build_rust backend-rust/huehub-token-distributor huehub-token-distributor 8080
build_rust backend-rust/payment-server           payment-server           8085
build_rust backend-rust/tss-ecdsa-server         tss-ecdsa-server         8080
build_rust backend-rust/unipass-bridge-validator unipass-bridge-validator 8080
build_rust backend-rust/unipass-wallet-relayer   unipass-wallet-relayer   8080
build_rust backend-rust/utxoswap-farm-sequencer  utxoswap-farm-sequencer  8080

# ─── backend-bin (precompiled) ───────────────────────────────────
build_bin backend-bin/apple-id-public-key       apple-public-key-monitor  8080
build_bin backend-bin/asset-migrator            unipass_asset_migrator    8080
build_bin backend-bin/denver-airdrop-rs         denver-airdrop-rs         8080
build_bin backend-bin/dexauto-data-center       substreams-sink-sql       8080
build_bin backend-bin/dkim-and-open-id-monitor  dkim-and-open-id-monitor  8080
build_bin backend-bin/huehub-rgbpp-indexer      rgbpp                     8080
build_bin backend-bin/paymaster-service         paymaster-service         8080
build_bin backend-bin/stackup-bundler           stackup-bundler           4337
build_bin backend-bin/trading-tracker           trading-tracker           8080
build_bin backend-bin/unipass-snap-service      snap-server               8080
build_bin backend-bin/unipass-wallet-tss        tss-ecdsa-server          8080
build_bin backend-bin/unipass-wallet-zk-server  unipass-wallet-zk-server  8080

# ─── Optional push ───────────────────────────────────────────────
if [ -n "$REGISTRY" ]; then
  log "Pushing all images to $REGISTRY"
  for img in $(docker images --format '{{.Repository}}:{{.Tag}}' | grep ":${TAG}$"); do
    docker tag "$img" "${REGISTRY}/${img}"
    docker push "${REGISTRY}/${img}"
  done
fi

log "Done — $(docker images --format '{{.Repository}}' | grep -v '<none>' | wc -l) images built."
