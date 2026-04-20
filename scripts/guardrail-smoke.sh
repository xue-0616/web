#!/usr/bin/env bash
# guardrail-smoke.sh
#
# Validates the fail-closed contract added in rounds 4-6 of the deep-
# audit remediation. Intended to run AFTER `scripts/rehearsal-up.sh`
# against the local compose stack — it does NOT start anything.
#
# Every assertion here corresponds to a documented guardrail in
# `docs/deployment-rehearsal.md` §4 / §4a / §4b. If one of these
# assertions fails, either:
#   (a) an operator changed an env var they shouldn't have, or
#   (b) someone silently removed a guardrail — either way, this
#       script is the early-warning.
#
# Exits 0 if every gate behaves as documented, non-zero otherwise.
# No external deps beyond `curl` and `jq`; macOS + Linux compatible.
#
# Usage:
#   bash scripts/guardrail-smoke.sh                     # default hosts
#   SWAP_PORT=18080 FARM_PORT=18086 bash scripts/...    # override ports

set -u
# Note: NO `set -e`. Each assertion runs independently so we can
# report a full pass/fail table at the end rather than bail on the
# first miss.

HOST="${HOST:-127.0.0.1}"
# NOTE: docker-compose.integration.yml currently ships relayer (8085),
# farm-seq (8086), distributor (8087). The utxo-swap-sequencer is NOT
# in the compose file yet; run it separately (e.g. `cargo run -p api
# --bin sequencer`) and export `SWAP_PORT` to point at it, or run this
# script with `SKIP_SWAP=1` to skip those assertions.
SWAP_PORT="${SWAP_PORT:-8080}"
FARM_PORT="${FARM_PORT:-8086}"
RELAYER_PORT="${RELAYER_PORT:-8085}"
SKIP_SWAP="${SKIP_SWAP:-0}"

total=0
passed=0
skipped=0
# Newline-delimited result lines, printed as a table at the end.
results=""

# Probe whether a service is reachable; returns 0 if yes.
service_up() {
  local port="$1"
  curl -sf -o /dev/null --max-time 2 "http://${HOST}:${port}/health"
}

# Helper: assert that GET $url returns HTTP status $want.
# $1 = label, $2 = url, $3 = want-status
assert_status() {
  local label="$1" url="$2" want="$3"
  total=$((total + 1))
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" || echo 000)"
  if [[ "$got" == "$want" ]]; then
    passed=$((passed + 1))
    results+=$'\n  \033[32mPASS\033[0m  '"${label}  (${got})"
  else
    results+=$'\n  \033[31mFAIL\033[0m  '"${label}  (want ${want}, got ${got})"
  fi
}

# Helper: assert that a POST $url with $body returns HTTP status $want.
# $want may be a `|`-separated list of acceptable codes, useful when
# an auth middleware sits in front of a fail-closed gate — both 401
# (auth short-circuited) and 503 (gate fired) are "fail closed" and
# equally acceptable for a guardrail smoke, because neither one
# accepted the intent.
assert_post_status() {
  local label="$1" url="$2" body="$3" want="$4"
  total=$((total + 1))
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
         -H 'Content-Type: application/json' \
         -X POST --data "$body" "$url" || echo 000)"
  # Match `got` against any `|`-separated alternative in `want`.
  local ok=0 alt
  IFS='|' read -ra alts <<<"$want"
  for alt in "${alts[@]}"; do
    [[ "$got" == "$alt" ]] && { ok=1; break; }
  done
  if [[ "$ok" == "1" ]]; then
    passed=$((passed + 1))
    results+=$'\n  \033[32mPASS\033[0m  '"${label}  (${got})"
  else
    results+=$'\n  \033[31mFAIL\033[0m  '"${label}  (want ${want}, got ${got})"
  fi
}

echo "guardrail smoke: HOST=${HOST}  swap=${SWAP_PORT}  farm=${FARM_PORT}  relayer=${RELAYER_PORT}"
echo

# --------------------------------------------------------------------
# swap-sequencer guardrails (optional — service not in default compose)
# --------------------------------------------------------------------
if [[ "$SKIP_SWAP" != "1" ]] && service_up "$SWAP_PORT"; then
  # MED-SW-1 — stub endpoints are fail-closed. The three /intents/*
  # stubs are behind JwtAuth + rate-limit; pools-admin/create is
  # behind JwtAuth too. Without a token the middleware short-
  # circuits with 401 BEFORE the handler returns 501, but either
  # code is acceptable: nothing reached the handler that might
  # accidentally mutate state. A 500 (old behaviour) or 200 (real
  # regression) would fail here.
  assert_post_status \
    "MED-SW-1  POST /api/v1/intents/swap-input-for-exact-output -> 401|501" \
    "http://${HOST}:${SWAP_PORT}/api/v1/intents/swap-input-for-exact-output" \
    '{}' '401|501'
  assert_post_status \
    "MED-SW-1  POST /api/v1/intents/add-liquidity -> 401|501" \
    "http://${HOST}:${SWAP_PORT}/api/v1/intents/add-liquidity" \
    '{}' '401|501'
  assert_post_status \
    "MED-SW-1  POST /api/v1/intents/remove-liquidity -> 401|501" \
    "http://${HOST}:${SWAP_PORT}/api/v1/intents/remove-liquidity" \
    '{}' '401|501'
  assert_post_status \
    "MED-SW-1  POST /api/v1/pools-admin/create -> 401|501" \
    "http://${HOST}:${SWAP_PORT}/api/v1/pools-admin/create" \
    '{}' '401|501'

  # MED-SW-2 — rehearsal env deliberately does NOT set
  # SEQUENCER_LOCK_CODE_HASH et al., so /configurations should 503
  # with an explanatory body. Operators who want 200 must set all 5
  # deployment env vars.
  assert_status \
    "MED-SW-2  GET /api/v1/configurations -> 503 (unset deployment vars)" \
    "http://${HOST}:${SWAP_PORT}/api/v1/configurations" \
    '503'

  # CRIT-SW-3 — /accounts/info now lives under /accounts-auth with
  # JwtAuth middleware, so a no-JWT call 401s.
  assert_status \
    "CRIT-SW-3  GET /api/v1/accounts-auth/info (no JWT) -> 401" \
    "http://${HOST}:${SWAP_PORT}/api/v1/accounts-auth/info" \
    '401'
else
  skipped=$((skipped + 6))
  results+=$'\n  \033[33mSKIP\033[0m  swap-sequencer @ '"${SWAP_PORT} not reachable (6 assertions skipped)"
fi

# --------------------------------------------------------------------
# HIGH-FM-3 / MED-FM-3 — farm submit routes are fail-closed
# --------------------------------------------------------------------
# Either the auth middleware short-circuits with 401 (no API key) or
# the FARM_PROCESSING_ENABLED=false gate fires with 503. Both are
# fail-closed and both prevent the intent from being accepted —
# accept either. A 200 / 400 / 500 here would be a real regression.
assert_post_status \
  "HIGH-FM-3  POST /api/v1/intents/submit -> 401|503 (fail-closed)" \
  "http://${HOST}:${FARM_PORT}/api/v1/intents/submit" \
  '{}' '401|503'
assert_post_status \
  "HIGH-FM-3  POST /api/v1/intents/submit-create-pool -> 401|503" \
  "http://${HOST}:${FARM_PORT}/api/v1/intents/submit-create-pool" \
  '{}' '401|503'

# --------------------------------------------------------------------
# Basic liveness — if these fail the other numbers are meaningless
# --------------------------------------------------------------------
if [[ "$SKIP_SWAP" != "1" ]] && service_up "$SWAP_PORT"; then
  assert_status "liveness: swap-seq /health"   "http://${HOST}:${SWAP_PORT}/health"   '200'
fi
assert_status "liveness: farm-seq /health"   "http://${HOST}:${FARM_PORT}/health"   '200'
assert_status "liveness: relayer /health"    "http://${HOST}:${RELAYER_PORT}/health" '200'

# --------------------------------------------------------------------
# Report
# --------------------------------------------------------------------
echo "results:${results}"
echo
echo "summary: ${passed}/${total} guardrail assertions passed (${skipped} skipped)"

# Skipped assertions are NOT failures — they mean the service isn't
# running, which is expected for swap-seq under the default compose.
if [[ "$passed" -eq "$total" ]]; then
  exit 0
fi
exit 1
