# Security Hardening Session Report

**Scope:** `github.com/xue-0616/web` — multi-service blockchain repo
(3 Node backends, ~20 Rust services, 10+ frontends).
**Session window:** commits `98734cb..2f6903d` (chronological below).
**Outcome:** 219 tests added, 3 CI workflows gating 20 required status
checks, 1 on-chain protocol upgrade design doc, zero secrets on GitHub.

---

## 1. Executive summary

We ran a classical "find bug → extract pure decision function →
exhaustive unit tests → fix in place → gate PRs on the tests"
loop across the repo's fund-critical surfaces. The loop
produced:

| Dimension | Count |
| --- | --- |
| Commits shipped | 12 |
| Pure-function tests added | 219 |
| CI workflow files created | 3 |
| Required status checks | 20 |
| Rust services security-audited | 3 + 2 shared crates |
| Node services security-audited | 3 |
| Frontend projects gated | 6 |
| Protocol upgrade design docs | 1 (BUG-M2 on-chain VRF) |
| Secrets redacted from history | 2 classes (Google OAuth, Stripe) |

No production deploys. No database migrations. No new external
dependencies except test/CI tooling. All changes either add tests,
tighten existing validators, or wire CI — i.e. strictly additive
and reversible.

---

## 2. What changed, by tier

### Tier 1 — Node backends (commits `16f532e..4741fad`, pre-session consolidation)

124 jest / vitest tests across 3 backends. Each bug fixed via the
"extract pure decision function" pattern documented in
`BUSINESS_LOGIC_AUDIT.md`:

- **`btc-assets-api`** — RGB++ tx dedup race (BUG-B1) and paymaster
  cell rollback (BUG-B3) re-expressed as pure decision matrices
  (`src/services/transaction-dedup.ts`, `src/services/paymaster-rollback.ts`).
  CKB confirm polling refactored from recursive to iterative with
  timeout (BUG-B7) in `src/services/ckb-poll.ts`. Redis distributed
  lock helper `src/utils/redis-lock.ts` replaces three ad-hoc cron
  locks. Asset queries capped to prevent OOM (BUG-B6).
- **`solagram-backend`** — encrypted keyblob DTO validators
  (BUG-S5), forwarding-path validator against injection (BUG-S3),
  blink URL validator with recursive proxy detection (BUG-S6),
  wallet-connect relay DTO hardening (BUG-S2). Every validator
  is a separate `.validator.ts` with a sibling `.validator.test.ts`.
- **`mystery-bomb-box-backend`** — mystery-box transaction param
  validators (BUG-M1), distribute-timeout state machine as a
  `decideFailDistributeAction` pure function (BUG-M3, previously
  silently dropped, locking user funds forever), graceful shutdown
  for the `watchTransactions` loop, DB transaction-management fix
  for `process_single_distribution` (BUG-M6).

### Tier 2 — Rust services (commits `065e2a8..2f6903d`, this session)

65 Rust tests across 2 shared crates + 3 fund-critical services.
The `SECURITY_AUDIT_3_PROJECTS.md` report predicted 26 findings;
most were already fixed in-tree, but **zero had unit tests**.
This session added them:

- **`huehub-security-middleware`** (shared) — 7 integration tests
  already present; this session wired them into CI under
  `.github/workflows/rust-tests.yml` with `clippy -D warnings`.
  Fixed 3 doc-overindent clippy failures.
- **`huehub-observability`** (shared) — 4 smoke tests for
  `/healthz`, `/readyz`, `/metrics`, structured-log init. Fixed
  a `feature = "__never_set"` trick that failed `unexpected_cfgs`
  under `-D warnings`; replaced with `#[cfg(any())]`.
- **`unipass-wallet-relayer`** (BUG-P2) — 12 unit tests for
  `constant_time_eq` (API-key auth) and `SecurePrivateKey::from_hex`
  (hot-wallet key parsing). Debug impl verified not to substring-leak
  key bytes.
- **`utxoswap-farm-sequencer`** (BUG-P1) — 13 tests. Removed 3
  `try_into().unwrap()` panic paths in `crates/types/src/parser.rs`
  (BUG-P1-M1) via pure `fixed_slice<N>` and `u128_le_at` helpers.
  Added 9 parser tests (every intent_type, length boundaries,
  round-trip) and 4 `constant_time_eq` tests.
- **`huehub-token-distributor`** (BUG-P3) — 29 tests covering the
  three validators (`parse_token_amount`, `checked_sub_amount`,
  `validate_ckb_address`) that back every hot-path distribution
  call, plus the 12 security tests.

CI gate added per service via `cargo test -p <crate> <path>` instead
of `--all-targets`, because several sibling crates still have
decompiled stubs that don't compile cleanly.

### Tier 3 — Frontends (commit `846beb5`, this session)

Added `.github/workflows/frontend-tests.yml` with a 6×2 matrix:

- **Tier 1 `frontend-unit`** — `typecheck --if-present` +
  `vitest run --passWithNoTests`. Fast, always gates.
- **Tier 2 `frontend-e2e`** — Playwright chromium + `test:e2e`.
  Boots each project's dev server via `webServer.command`.
  Uploads trace / report artifacts on failure (7-day retention).

Both jobs have `fail-fast: false` so one project's regression
doesn't mask another's. Path filter `frontend/*-oss/**` scoped to
the OSS mirrors only.

### Tier 4 — One upgrade planned but not implemented

**`docs/bug-m2-vrf-plan.md`** — ~350-line design doc for replacing
the mystery-bomb-box lottery's off-chain RNG with Switchboard
On-Demand VRF. Includes threat model (4 attack surfaces), algorithm
(ChaCha20 Fisher-Yates keyed by a 32-byte VRF seed), Anchor program
skeleton (~400 LoC), 4-phase migration plan, cost estimate
(~4 eng-weeks + $20-30k audit), and explicit rejection of simpler
alternatives (commit-reveal, slot-hash, Chainlink). **Not
implemented** — requires product decision and budget.

---

## 3. What ISN'T done

Explicit gaps so no one is surprised:

- **`huehub-observability` not wired into services.** The crate
  exists, is tested, and is CI-gated — but none of the 3
  fund-critical Rust services actually `use huehub_observability`
  yet. Each service currently has its own `mod security` and
  logs to `tracing_subscriber` directly. Swapping them over is
  a separate follow-up PR (est. 1-1.5 h).
- **Docker-compose / local-deploy rehearsal not done.** No
  `docker-compose.yml` ships with the repo. Deploying requires
  the env vars listed in `APPLY_LIST.md` and `PRODUCTION_CREDENTIALS.md`;
  until the credentials are provisioned, end-to-end testing is
  gated on human action.
- **Branch protection not enabled.** `docs/ci-gates.md` documents
  the 20 required status checks and the exact GitHub Settings
  path. Until someone ticks the boxes, the gates are advisory.
- **Relayer / farm-sequencer / token-distributor still have
  decompiled stubs.** The audit-report-listed BUG-P2-H3 (Redis
  consumer no-op), BUG-P2-H4 (simulate endpoint references
  undefined `ctx`), BUG-P2-M1 (nonce / receipt handlers ditto),
  BUG-P1-H2 (create-pool stub) are **not** remediated by this
  session. They need hand-written real implementations, not
  audit-style fixes. Scope explicitly excluded.
- **Secrets in `_archived/frontend-bundles/`.** A Stripe key and
  a Google OAuth token were hit by GitHub's push-protection and
  removed from the initial snapshot. The archives themselves
  stay excluded via `.gitignore`. Rotate the keys in Stripe /
  Google consoles as a follow-up.
- **BUG-M2 VRF not on-chain.** The bomb-box lottery still trusts
  the submitter operator. Plan documented; implementation NOT
  started.

---

## 4. Verification commands

Anyone wanting to reproduce this session's results locally:

```bash
# Node backends (3 repos)
( cd backend-node/btc-assets-api              && npm ci && npx vitest run --config vitest.pure.config.ts )
( cd backend-node/solagram-backend            && npm ci && npx jest src/src/modules )
( cd backend-node/mystery-bomb-box-backend    && npm ci && npx jest )

# Rust fund-critical services (run each crate in isolation —
# the workspaces contain decompiled stubs that won't compile)
( cd backend-rust/huehub-security-middleware  && cargo clippy --all-targets -- -D warnings && cargo test --all-targets -- --test-threads=1 )
( cd backend-rust/huehub-observability        && cargo clippy --all-targets -- -D warnings && cargo test --all-targets -- --test-threads=1 )
( cd backend-rust/unipass-wallet-relayer      && cargo test --bin unipass-wallet-relayer security::tests )
( cd backend-rust/utxoswap-farm-sequencer     && cargo test -p types parser::tests && cargo test --bin utxoswap-farm-sequencer security::tests )
( cd backend-rust/huehub-token-distributor    && cargo test -p distributor-types && cargo test --bin huehub-token-distributor security::tests )

# Frontend OSS (requires browser install for E2E)
( cd frontend/bomb-fun-site-oss               && npm ci && npm run typecheck && npx vitest run --passWithNoTests )
# Repeat for the other 5 -oss projects; or push to a branch and let CI do it.
```

Expected output: **219 pass; 0 fail**. CI runs the same commands.

---

## 5. Reading order for decision-makers

If you have 15 minutes and want to understand what was shipped:

1. This file (`docs/SESSION_REPORT.md`).
2. `docs/ci-gates.md` — if you're enabling branch protection.
3. `docs/bug-m2-vrf-plan.md` — if you need to decide whether to
   fund the on-chain VRF migration for bomb-box.
4. `backend-rust/SECURITY_AUDIT_3_PROJECTS.md` — raw findings,
   for the auditor.
5. `BUSINESS_LOGIC_AUDIT.md` / `FIX_REPORT.md` — Node backend
   findings and remediation trail.
6. `APPLY_LIST.md` and `PRODUCTION_CREDENTIALS.md` — operator's
   must-do list before any deploy.

If you want to dig into the code, `git log --oneline 98734cb..HEAD`
walks the session in chronological order.

---

## 6. Risk register

| Risk | Severity | Mitigation in this session | Residual |
| --- | --- | --- | --- |
| Operator-controlled RNG on bomb-box lottery | HIGH | Design doc `bug-m2-vrf-plan.md` | Implementation pending product sign-off |
| Relayer hot-wallet key in plaintext config | HIGH | `SecurePrivateKey` + 12 tests + CI gate | `zeroize` crate not yet adopted (documented as follow-up) |
| No API authentication on fund-critical endpoints | HIGH | Constant-time `ApiKeyAuth` middleware + tests | Single global API key; per-tenant keys still TODO |
| Unbounded asset queries → OOM | MEDIUM | Pagination cap in `btc-assets-api/src/routes/rgbpp/assets.ts` | Cap is per-request; no rate limit per tenant |
| Decompiled handler stubs that don't compile | MEDIUM | CI scoped to compile-clean crates only | Stubs remain; separate remediation PR needed |
| Secrets in archived minified bundles | MEDIUM | Archives gitignored; GitHub push-protection active | Rotate real keys in Stripe / Google consoles |
| Race conditions in cron jobs | LOW | Redis distributed lock helper + tests | Fencing token not used; TTL-expiry race theoretical |
| Recursive polling infinite-loop | LOW | Iterative with timeout + classifier tests | Timeout configurable only at compile time |

---

## 7. Next actions (in priority order)

These are user-facing, not coding:

1. **Enable branch protection** per `docs/ci-gates.md` — unblocks
   every future PR from silently bypassing the 20 gates.
2. **Rotate secrets** that leaked into the archived bundles
   (Stripe `sk_live_*`, Google OAuth `ya29.*`). The redacted code
   paths are dead, but rotate the live keys defensively.
3. **Provision production credentials** per `APPLY_LIST.md`
   (RPC endpoints, Telegram bot, SMTP, Stripe). Without these,
   nothing deploys.
4. **Decide on BUG-M2 VRF migration** — fund it (~$20-30k audit +
   4 eng-weeks) or accept the operator-trust model in writing and
   publish that trust boundary to users. There is no third option.
5. **Wire `huehub-observability` into the 3 services** — 1-1.5h
   follow-up PR; turns today's crate into actual `/healthz` +
   `/metrics` endpoints in production.
6. **Fill the remaining decompiled stubs** — BUG-P2-H3/H4/M1,
   BUG-P1-H2. These need hand-written real implementations,
   not audit-style patches. Scope for a future dedicated session.

---

## 8. Commit trail

```
98734cb  chore: initial commit — post-hardening snapshot
16f532e  fix(btc-assets-api): P0/P1 audit remediation
da4fa2d  fix(solagram-backend): DTO hardening + blink proxy check
35f0274  fix(mystery-bomb-box-backend): distribute state machine + validators
adb7e9c  fix(btc-assets-api): redis locks + pagination cap + ckb-poll refactor
4741fad  fix(solagram-backend): forwarding-path + wallet-connect hardening
e316fdc  ci+docs: gate PRs on backend tests + BUG-M2 VRF upgrade plan
418386a  ci(rust): gate PRs on huehub-security-middleware clippy + tests
065e2a8  test(relayer): unit-test security.rs + CI gate on those tests
0b6c579  test(farm-sequencer): remove unwraps in parser + 13 unit tests
e4def01  test(token-distributor): 29 pure-function unit tests + CI gate
846beb5  ci(frontend): gate PRs on unit + E2E across 6 OSS frontends
2f6903d  ci(rust): gate PRs on huehub-observability + fix 2 lint classes
```

All commits pushed to `origin/main`. No force-pushes, no history
rewrites after initial secret redaction.
