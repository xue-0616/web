#!/usr/bin/env bash
# Unified CI/local check entry point.
#
# Usage:
#   scripts/ci-check.sh               # run everything
#   scripts/ci-check.sh ts            # only TypeScript projects
#   scripts/ci-check.sh rust          # only Rust workspaces
#   scripts/ci-check.sh python        # only Python
#   scripts/ci-check.sh --list        # list what would run, don't execute
#
# Exit code: 0 = all green, 1 = at least one project failed.

set -uo pipefail
shopt -s nullglob

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Colors only if stdout is a TTY
if [[ -t 1 ]]; then
  G="$(printf '\033[32m')"; R="$(printf '\033[31m')"; Y="$(printf '\033[33m')"; N="$(printf '\033[0m')"
else
  G=""; R=""; Y=""; N=""
fi

MODE="${1:-all}"
if [[ "$MODE" == "--list" ]]; then LIST_ONLY=1; MODE="all"; else LIST_ONLY=0; fi

FAIL_COUNT=0
PASS_COUNT=0
declare -a FAILED_PROJECTS=()

run_check() {
  local label="$1"; shift
  if (( LIST_ONLY )); then
    echo "  would run: $label"
    return 0
  fi
  echo "${Y}▶ $label${N}"
  if "$@"; then
    PASS_COUNT=$((PASS_COUNT+1))
    echo "${G}  ✓ $label${N}"
  else
    FAIL_COUNT=$((FAIL_COUNT+1))
    FAILED_PROJECTS+=("$label")
    echo "${R}  ✗ $label${N}"
  fi
}

# ---------- TypeScript ----------
check_ts() {
  local dir="$1"
  pushd "$dir" >/dev/null || return 1
  # Use the Node API so --incremental/--noEmit quirks don't mask results.
  if [[ ! -d node_modules/typescript ]]; then
    echo "    (no node_modules; skipping — run \`npm ci\` first)"
    popd >/dev/null
    return 0
  fi
  local errs
  errs=$(node -e "
const ts = require('typescript');
const cfg = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (cfg.error) { console.error(ts.flattenDiagnosticMessageText(cfg.error.messageText, '\n')); process.exit(1); }
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, '.');
const files = parsed.fileNames.filter(f => !f.includes('/test/') && !f.endsWith('.spec.ts'));
const opts = {...parsed.options, noEmit:true, incremental:false, tsBuildInfoFile:undefined};
const program = ts.createProgram(files, opts);
const diag = ts.getPreEmitDiagnostics(program).filter(d => d.file);
for (const d of diag.slice(0, 10)) {
  const f = d.file.fileName.replace(process.cwd()+'/', '');
  const pos = ts.getLineAndCharacterOfPosition(d.file, d.start);
  console.error(f + ':' + (pos.line+1) + ':' + (pos.character+1) + ' TS' + d.code + ': ' + ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}
console.log(diag.length);
" 2>&1)
  local code=$?
  local last_line="${errs##*$'\n'}"
  popd >/dev/null
  if [[ $code -ne 0 ]] || [[ "$last_line" != "0" ]]; then
    echo "$errs" | head -20 | sed 's/^/    /'
    return 1
  fi
  return 0
}

run_ts_all() {
  echo "${Y}=== TypeScript projects ===${N}"
  for d in backend-node/*/; do
    local n="$(basename "$d")"
    [[ -f "$d/tsconfig.json" ]] || continue
    [[ -f "$d/package.json" ]] || continue
    run_check "ts:$n" check_ts "$d"
  done
}

# ---------- Rust ----------
check_rust() {
  local dir="$1"
  pushd "$dir" >/dev/null || return 1
  local out
  out=$(cargo check --offline --all-targets 2>&1)
  local code=$?
  popd >/dev/null
  if [[ $code -ne 0 ]]; then
    echo "$out" | tail -30 | sed 's/^/    /'
    return 1
  fi
  return 0
}

run_rust_all() {
  echo "${Y}=== Rust projects ===${N}"
  for d in backend-rust/*/; do
    local n="$(basename "$d")"
    [[ -f "$d/Cargo.toml" ]] || continue
    run_check "rust:$n" check_rust "$d"
  done
}

# ---------- Go ----------
check_go() {
  local dir="$1"
  pushd "$dir" >/dev/null || return 1
  local out
  # `go build` without `-o` produces no artefact (unless it's a main pkg
  # with $GOPATH/bin writable); `./... ` covers every subpackage.
  out=$(go build ./... 2>&1)
  local code=$?
  popd >/dev/null
  if [[ $code -ne 0 ]]; then
    echo "$out" | tail -30 | sed 's/^/    /'
    return 1
  fi
  return 0
}

run_go_all() {
  echo "${Y}=== Go projects ===${N}"
  for d in backend-go/*/; do
    local n="$(basename "$d")"
    [[ -f "$d/go.mod" ]] || continue
    run_check "go:$n" check_go "$d"
  done
}

# ---------- Python ----------
check_python() {
  local dir="$1"
  python3 -c "
import ast, sys, pathlib
errs = 0
for p in pathlib.Path('$dir').rglob('*.py'):
    if '__pycache__' in str(p) or 'venv' in str(p) or '.venv' in str(p):
        continue
    try:
        ast.parse(p.read_text())
    except SyntaxError as e:
        print(f'    {p}:{e.lineno}: {e.msg}', file=sys.stderr)
        errs += 1
sys.exit(1 if errs else 0)
" 2>&1
}

run_python_all() {
  echo "${Y}=== Python projects ===${N}"
  for d in backend-python/*/; do
    local n="$(basename "$d")"
    [[ -f "$d/requirements.txt" || -f "$d/pyproject.toml" ]] || continue
    run_check "py:$n" check_python "$d"
  done
}

# ---------- dispatch ----------
check_phase5() {
  local root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  "$root/scripts/phase5-check.sh" > /dev/null 2>&1
}
run_phase5() {
  echo "${Y}=== Phase 5 frontend wrappers ===${N}"
  run_check "phase5:frontend-oss-wrappers" check_phase5 .
}
check_phase6() {
  local root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  "$root/scripts/phase6-check.sh" > /dev/null 2>&1
}
run_phase6() {
  echo "${Y}=== Phase 6 greenfield scaffolds ===${N}"
  run_check "phase6:greenfield-scaffolds" check_phase6 .
}
check_phase7() {
  local root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  "$root/scripts/phase7-check.sh" > /dev/null 2>&1
}
run_phase7() {
  echo "${Y}=== Phase 7 HueHub/Solagram/Bomb.fun scaffolds ===${N}"
  run_check "phase7:greenfield-scaffolds" check_phase7 .
}

case "$MODE" in
  ts)     run_ts_all ;;
  rust)   run_rust_all ;;
  go)     run_go_all ;;
  python) run_python_all ;;
  phase5) run_phase5 ;;
  phase6) run_phase6 ;;
  phase7) run_phase7 ;;
  all)    run_ts_all; run_rust_all; run_go_all; run_python_all; run_phase5; run_phase6; run_phase7 ;;
  *)      echo "usage: $0 [ts|rust|go|python|phase5|phase6|phase7|all|--list]" >&2; exit 2 ;;
esac

if (( LIST_ONLY )); then exit 0; fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $FAIL_COUNT -eq 0 ]]; then
  echo "${G}All $PASS_COUNT check(s) passed.${N}"
  exit 0
else
  echo "${R}$FAIL_COUNT failed, $PASS_COUNT passed.${N}"
  echo "${R}Failed:${N}"
  for p in "${FAILED_PROJECTS[@]}"; do echo "  - $p"; done
  exit 1
fi
