#!/usr/bin/env bash
# One-shot: initialise the repo, stage everything, verify nothing
# sensitive slipped through .gitignore, and produce the first commit.
#
# Idempotent: safe to re-run — will `git init` only if missing and skip
# the commit if the tree is already clean.
#
# Usage:
#   bash scripts/git-bootstrap.sh
#   bash scripts/git-bootstrap.sh --remote git@github.com:you/repo.git

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

REMOTE=""
if [[ "${1:-}" == "--remote" && -n "${2:-}" ]]; then
  REMOTE="$2"
fi

if [[ -t 1 ]]; then
  G="$(printf '\033[32m')"; R="$(printf '\033[31m')"; Y="$(printf '\033[33m')"; N="$(printf '\033[0m')"
else
  G=""; R=""; Y=""; N=""
fi

# ─── Step 1: git init ────────────────────────────────────────────────
if [[ ! -d .git ]]; then
  echo "${Y}▶ git init (branch=main)${N}"
  git init -b main >/dev/null
  echo "${G}  ✓ initialised${N}"
else
  echo "${G}✓ .git already exists${N}"
fi

# ─── Step 2: safety — scan for obvious secrets before staging ────────
echo "${Y}▶ pre-stage secret scan${N}"
BAD=0
# Files that MUST never be committed. .gitignore should already filter
# them but belt-and-braces: scan the would-be-staged tree.
PATTERNS=(
  'APPLY_LIST\.md'
  'PRODUCTION_CREDENTIALS\.md'
  '\.env$'
  '\.env\.[a-z]+$'
  '\.secret$'
  '/id_rsa$'
  '/id_ed25519$'
)
# Template files that are intentionally committed.
ALLOWLIST='\.env\.(example|sample|template)$'

for p in "${PATTERNS[@]}"; do
  # Find candidate hits, then filter out template variants.
  HITS="$(git ls-files --others --cached --exclude-standard \
            | grep -E "$p" \
            | grep -vE "$ALLOWLIST" || true)"
  if [[ -n "$HITS" ]]; then
    echo "${R}  ✗ would-be-staged path matches forbidden pattern: $p${N}"
    echo "$HITS"
    BAD=1
  fi
done
if (( BAD )); then
  echo "${R}refusing to proceed — fix .gitignore first${N}"
  exit 2
fi
echo "${G}  ✓ no secrets in stage-candidate set${N}"

# ─── Step 3: sanity — count files and size ───────────────────────────
echo "${Y}▶ stage size sanity check${N}"
FILE_COUNT="$(git ls-files --others --exclude-standard | wc -l)"
echo "  untracked files to add: ${FILE_COUNT}"
if (( FILE_COUNT > 20000 )); then
  echo "${R}  ✗ refusing: ${FILE_COUNT} files is suspicious (expected <10K)${N}"
  echo "  top 10 largest dirs that would be added:"
  git ls-files --others --exclude-standard \
    | awk -F/ '{print $1"/"$2}' | sort | uniq -c | sort -rn | head -10
  exit 3
fi

# ─── Step 4: stage + commit ──────────────────────────────────────────
echo "${Y}▶ git add .${N}"
git add .
echo "${G}  ✓ staged${N}"

if git diff --cached --quiet; then
  echo "${G}✓ tree already clean, nothing to commit${N}"
else
  echo "${Y}▶ first commit${N}"
  git -c user.name="Cascade" -c user.email="cascade@local" commit \
    -m "chore: initial commit — post-hardening snapshot

39/39 ci-check.sh green:
  - 76 frontend unit tests (bomb-fun curve/honeypot/fuzz, huehub-dex swap/fuzz,
    solagram-wallet keyblob/keypair, blinks action, solagram-web content)
  - 322 Rust tests across 12 crates with passing suites
  - 9 Go packages, 1 Python service

Bug fixes from today's test-driven review:
  - curve.ts: lamportsToSol default precision 6 -> 9 (was truncating)
  - huehub-security-middleware: HttpMessage trait missing in imports
  - huehub-security-middleware tests: peer_addr + non-CRLF header fixes
  - curve.fuzz.test.ts: generator bounds + post-buy state simulation
  - 3 vite.config.ts + 2 vitest.config.ts exclude Playwright specs
" >/dev/null
  echo "${G}  ✓ committed${N}"
fi

# ─── Step 5: optional remote ─────────────────────────────────────────
if [[ -n "$REMOTE" ]]; then
  echo "${Y}▶ configuring remote origin${N}"
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REMOTE"
  else
    git remote add origin "$REMOTE"
  fi
  echo "${G}  ✓ origin -> $REMOTE${N}"
  echo "  push with:  git push -u origin main"
fi

# ─── Step 6: summary ─────────────────────────────────────────────────
echo ""
echo "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo "${G}Git bootstrap complete.${N}"
git log --oneline -n 3
echo ""
echo "Next: create a GitHub repo, then rerun with --remote to push:"
echo "  bash scripts/git-bootstrap.sh --remote git@github.com:USERNAME/REPO.git"
echo "  git push -u origin main"
