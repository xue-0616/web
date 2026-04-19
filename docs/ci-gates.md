# CI Gates & Branch Protection Setup

**Audience:** anyone with admin access to `github.com/xue-0616/web`.
**Time:** ~10 minutes, one-time setup.
**Why:** without branch protection, the 22 CI status checks below are
suggestions, not gates. A PR can be merged while the checks are red.
This document lists the exact check names to require so the gates
actually stop merges.

---

## TL;DR — what you need to do

1. Go to **Settings → Branches → Add rule** (or edit existing `main` rule).
2. Branch name pattern: `main`
3. Tick **Require a pull request before merging**.
4. Tick **Require status checks to pass before merging**.
5. Tick **Require branches to be up to date before merging**.
6. In the "Search for status checks" box, search for and add every
   check name listed in [§ required status check names](#required-status-check-names) below.
7. (Recommended) tick **Do not allow bypassing the above settings**
   so admins can't accidentally merge red PRs.
8. Save.

From then on, every PR into `main` must have all required checks green.

> **First-run note:** GitHub only lets you select a status check
> *after* it has run at least once on the repo. If a check name doesn't
> appear in the search box, open a throwaway PR that touches the
> relevant path filter (e.g. `backend-node/btc-assets-api/README.md`)
> to trigger it, then come back here and add it.

---

## Required status check names

Group them by workflow so you can paste 3 groups into the search box
and not miss any.

### Group 1 — `backend-tests.yml` (3 checks)

Gates: Node backends with full jest / vitest suites.
Path filter: `backend-node/{btc-assets-api,solagram-backend,mystery-bomb-box-backend}/**`

```
btc-assets-api (vitest pure)
solagram-backend (jest modules)
mystery-bomb-box-backend (jest)
```

Coverage: 124 unit tests across pure validators and decision
matrices added in commits `16f532e..4741fad`.

### Group 2 — `rust-tests.yml` (5 checks)

Gates: 2 shared crates + pure-function suites of 3 fund-critical services.

```
huehub-security-middleware (cargo test)
huehub-observability (cargo clippy + test)
unipass-wallet-relayer src/security.rs (cargo test security::tests)
utxoswap-farm-sequencer (parser + security::tests)
huehub-token-distributor (distributor-types + security::tests)
```

Coverage: 65 Rust tests across request-id / audit log / rate limit
(middleware), health / metrics / logs (observability), and the hot-path
validators that back every signing / auth / parse step in the 3 services.

### Group 3 — `frontend-tests.yml` (12 checks — 6 projects × 2 tiers)

Gates: 6 OSS frontends, matrix-expanded across unit + E2E tiers.

```
unit (auto-dex-site-oss)
unit (blinks-miniapp-oss)
unit (bomb-fun-site-oss)
unit (huehub-dex-site-oss)
unit (solagram-wallet-oss)
unit (solagram-web-site-oss)
e2e (auto-dex-site-oss)
e2e (blinks-miniapp-oss)
e2e (bomb-fun-site-oss)
e2e (huehub-dex-site-oss)
e2e (solagram-wallet-oss)
e2e (solagram-web-site-oss)
```

Coverage: `typecheck` + `vitest` + Playwright smoke (1 spec per project,
boots each app's dev server on :5173 with a 90 s timeout).

**Optional:** if you want to keep PRs merge-able while the Playwright
E2E tier stabilises in CI, add only the 6 `unit (…)` checks as
required and leave the 6 `e2e (…)` as informational for a week.
Then flip them on once the pass-rate is stable.

### Summary

| Workflow | Required checks | Test count |
| --- | --- | --- |
| `backend-tests.yml` | 3 | 124 |
| `rust-tests.yml` | 5 | 65 |
| `frontend-tests.yml` | 12 (6 unit + 6 e2e) | ~30 |
| **Total** | **20 required status checks** | **~219 tests** |

---

## Optional hardening

Once the above is stable, also consider:

- **Require signed commits** — Settings → Branches → tick
  "Require signed commits". Forces every commit author to sign with
  a GPG / ssh key registered to their GitHub account. Deters rogue
  pushes from a stolen workstation cookie.
- **Require linear history** — rejects merge commits, forcing
  rebase-only workflow. Keeps `git log --oneline` readable but is a
  cultural choice; skip if the team uses merge commits deliberately.
- **Restrict who can push to `main`** — even with PRs required,
  this adds belt-and-suspenders. List only the 1-2 accounts that
  should ever issue manual pushes (emergency hotfix).
- **Lock down deploy secrets** — Settings → Secrets and variables
  → Actions → "Repository secrets". Any key that lands here is
  readable by every workflow run; rotate on compromise.

---

## What the gates DO NOT catch

Explicit non-goals, so no one is surprised:

- **Runtime bugs in un-audited code paths.** The gates only test
  what we wrote tests for. The half-reconstructed / decompiled
  handler crates in `unipass-wallet-relayer/crates/relayer/` and
  elsewhere have no coverage — gate failures tell you the pure
  validators / shared middleware broke, not that the whole service
  is healthy.
- **On-chain logic.** The `BUG-M2` bomb-box lottery still runs
  off-chain; see `docs/bug-m2-vrf-plan.md` for the upgrade plan.
  No CI gate can turn an off-chain RNG into an on-chain VRF.
- **Secrets in `_archived/` dumps.** GitHub secret-scanning
  already blocks known formats at push-time (we hit this during
  the initial commit push; see `FIX_REPORT.md`). But the scanner
  only knows about format regexes — a hand-crafted custom token
  won't trigger it. Review the secret-scanning dashboard monthly.
- **Deploy-time misconfiguration.** None of the 3 workflows run
  `npm run build` or `cargo build --release`. A typo in a dist-
  only import will pass CI and break prod. Consider adding a
  build step if this starts happening.

---

## Emergency override

If you hit a situation where a critical hotfix must merge past
red checks:

1. Do NOT disable branch protection globally — that removes the
   gates for every future PR until someone remembers to re-enable.
2. Instead, on the PR itself, admins can click "Bypass branch
   protection" once (the button appears next to "Merge pull
   request" when admin-bypass is enabled at the rule level).
3. Immediately after merging, open a follow-up PR that either
   fixes the failing check or explicitly marks it as non-blocking
   with a comment pointing to the incident.

If admin-bypass is NOT enabled (recommended default), the only
path is to push a one-line fix through the normal PR flow. The
CI turnaround on this repo is ~5 minutes for Node and ~10 for Rust,
so this is rarely worse than the bypass route anyway.
