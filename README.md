# 链上自动化交易源码 — Rebuild Project

Full-stack recovery + OSS rewrite of a Web3 trading / wallet platform
(HueHub + UniPass + Solagram + Bomb.fun). Combines upstream source
(where available) with ground-up rewrites of closed-source Rust ELFs.

## Current status

**All 37 CI checks green** — `./scripts/ci-check.sh` covers every crate, every
TS project, every Go service, every Python service, and the 3 phase-structure
sanity checks.

For a complete account of what was rewritten in the most recent major
session, see `SESSION_REPORT.md`.

## Directory layout

```
├── backend-rust/         # 18 Rust crates — 9 OSS rewrites + 9 pre-existing
├── backend-go/           # stackup-bundler (upstream fork) + substreams-sink-sql
├── backend-node/         # 14 NestJS/Node backends (pre-existing)
├── backend-python/       # devops-data-sentinel
├── backend-bin/          # The original closed-source ELFs (read-only reference)
├── frontend/             # 19 *-oss projects (Phase 5/6/7) + *-src bundle extracts
├── upstream/             # Cloned open-source upstreams (pristine)
├── scripts/              # ci-check + phase5/6/7 structure validators
├── .github/workflows/    # GitHub Actions CI (includes real npm install + build)
└── docker-compose.dev.yml  # Dev-mode full-stack bootstrap
```

## The three tracks

| Track | Scope | Status |
|---|---|---|
| **B** — Infrastructure (ELF replacement) | 12 closed-source Rust ELFs ⇒ OSS sources | 9 ✅ + 3 🟡 (blocked on external services) |
| **C** — Frontend rewrite | 19 `-oss/` projects across 3 phases | Phase 5 ✅ · Phase 6 ✅ · Phase 7 🟡 scaffold |
| **D** — Engineering infra | CI / Docker / docs | CI ✅ · compose ✅ · docs ✅ |

Detailed per-project status: `TRACK_B_STATUS.md`, `TRACK_C_STATUS.md`.

Per-phase contracts + 回归保护: `frontend/PHASE_5_MAP.md`, `PHASE_6_MAP.md`,
`PHASE_7_MAP.md`, `frontend/DESIGN_TOKENS.md`.

## Quick start

### Local dev stack

```bash
# One-shot bring-up: MySQL + Redis + 3 Rust services.
docker compose -f docker-compose.dev.yml up --build

# With frontend hot-reload too:
docker compose -f docker-compose.dev.yml --profile frontend up
```

Dev configs live at:
- `backend-rust/paymaster-service-oss/config.dev.json`
- `backend-rust/unipass-snap-service-oss/config.dev.json`
- `backend-rust/huehub-rgbpp-indexer-oss/config.dev.json`

### Run tests for a single project

```bash
# Rust
cd backend-rust/paymaster-service-oss && cargo test --lib

# Frontend
cd frontend/unipass-auth0-verify-code-oss && npm install && npm test
```

### Validate the whole repo's structure

```bash
./scripts/ci-check.sh           # every language + every phase check
./scripts/phase5-check.sh       # just Phase 5 upstream wrappers
./scripts/phase6-check.sh       # just Phase 6 UniPass greenfield
./scripts/phase7-check.sh       # just Phase 7 HueHub/Solagram/Bomb.fun
```

### Continuous integration

`.github/workflows/ci.yml` runs 6 jobs in parallel on every push / PR:

1. `node-typecheck` — 14 existing NestJS backends
2. `rust-check` — 18 Rust crates with `cargo check + clippy + test`
3. `go-build` — `stackup-bundler` + `substreams-sink-sql`
4. `python-check` — `devops-data-sentinel`
5. **`frontend-oss`** — 11 greenfield frontend projects (Phase 6+7), each
   runs the real `npm install && npm run typecheck && npm test && npm run build`
6. **`phase-checks`** — Phase 5/6/7 structural validation (<1s)

All gated by `ci-gate`; any failing job blocks merge.

## Tracking documents

| File | Purpose |
|---|---|
| `SESSION_REPORT.md` | Latest major session's results + honest accounting |
| `REBUILD_MASTER_PLAN.md` | The original plan with phase breakdown + estimates |
| `TRACK_B_STATUS.md` | Per-ELF rewrite status (12 ELFs) |
| `TRACK_C_STATUS.md` | Per-frontend-project rewrite status (19 projects) |
| `frontend/PHASE_5_MAP.md` | 8 upstream→wrapper mappings |
| `frontend/PHASE_6_MAP.md` | 5 UniPass greenfield projects + backend wiring |
| `frontend/PHASE_7_MAP.md` | 6 HueHub/Solagram/Bomb.fun greenfield scaffolds |
| `frontend/DESIGN_TOKENS.md` | Shared brand tokens convention |
| `frontend/unipass-cms-frontend-oss/BACKEND_CONTRACT.md` | ra-data-simple-rest contract |

## Known gaps (honest accounting)

See `SESSION_REPORT.md` § 8 for the canonical list. Summary:

| Track B 🟡 | Needs |
|---|---|
| `asset-migrator-oss` 3 workers | MySQL + Redis + ethers (~1 week) |
| `denver-airdrop-rs-oss` chain connector | ethers provider (deployment-specific) |
| `unipass-wallet-zk-server-oss` real prover | `upstream/UniPass-email-circuits` + 4 MB SRS |

Phase 7 scaffolds are intentionally UI-less — 55 person-days of design
work to rebuild UIs from production screenshots. Each scaffold has
business integration points already noted in its `App.tsx`.

## License

Per-project. OSS rewrites are MIT-or-Apache-2.0. Upstream clones under
`upstream/` keep their original licenses (mostly Apache-2.0).

## Conventions

- **Every `-oss` directory has**: `README.md`, `UPSTREAM` (or `greenfield` marker),
  `scripts/build.sh`, `.env.example` where applicable, `package.json` or
  `Cargo.toml` committed with `*-lock` files.
- **Every Rust crate exposes tests**: `cargo test --lib` runs in <10s per crate.
- **Every frontend exposes `npm test`** (even if the test is just a tokens
  invariant — see `unipass-wallet-official-website-oss/src/content.test.ts`
  for the minimal pattern).
- **Branding**: shared design tokens under `src/design/tokens.{css,ts}` in
  every Phase 6 project; increment `TOKENS_VERSION` on palette changes.
