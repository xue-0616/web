# Deployment Rehearsal — 6 Fund-Critical Services

**Goal:** stand up the three hardened Node backends and three hardened
Rust services **locally against devnet/testnet RPC** to verify the
code, Dockerfiles, and environment-variable surface work end-to-end
before any production pushes.

**Not covered here:** mainnet credentials, TLS, reverse proxy,
observability scraping, secret rotation. Those come after rehearsal.

---

## What you get

| Host port | Service | Why it matters |
|---|---|---|
| 3000 | `btc-assets-api` | RGB++ + Bitcoin assets API |
| 3001 | `solagram-backend` | Solana social / wallet backend |
| 3002 | `mystery-bomb-box-backend` | Bomb-box lottery backend |
| 3306 | MySQL 8 | Shared DB for Node + Rust services |
| 6379 | Redis 7 | Distributed locks, bull queues, rate-limit |
| 8085 | `unipass-wallet-relayer` (Rust) | EVM meta-tx relayer |
| 8086 | `utxoswap-farm-sequencer` (Rust) | CKB farm sequencer |
| 8087 | `huehub-token-distributor` (Rust) | CKB xUDT distributor |

All six services expose `/health` (legacy) and the three Rust ones
additionally expose `/healthz`, `/readyz`, and `/metrics` (Prometheus
exposition format) from the shared `huehub-observability` crate.

---

## Prerequisites

- Docker 24+ with BuildKit enabled (the default since Docker 23).
- ~6 GB free disk (first build caches the Rust registry).
- A devnet/testnet Solana RPC URL. Helius free tier is fine.
- (Optional) A CKB testnet RPC URL.

## TL;DR — one-shot script

Everything below is wrapped in `scripts/rehearsal-up.sh`, which is
idempotent and safe to re-run:

```bash
bash scripts/rehearsal-up.sh        # set up, build, bring up, probe
bash scripts/rehearsal-down.sh      # stop (keep data)
bash scripts/rehearsal-down.sh --wipe   # stop + delete ./data
```

The script:
1. Verifies `docker` daemon is reachable.
2. Installs `docker compose` v2 to `~/.docker/cli-plugins/` if absent
   (no `sudo` required).
3. Creates `.env.integration` from the template and fills every
   `openssl rand -hex 32`-class secret automatically. **Never
   overwrites an existing `.env.integration`.**
4. Brings up mysql + redis, waits for both to report `healthy`.
5. Builds + brings up the 6 app services (first run ~8–15 min).
6. Polls `/health` on every service for up to 180 s and prints a
   pass/fail table.

The manual steps below explain what the script does if you'd rather
walk through it by hand or debug a failing step.

## 1. Create `.env.integration`

```bash
cp docs/env.integration.example .env.integration
$EDITOR .env.integration
```

At minimum fill in:

- `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` — anything random
- `JWT_SECRET` — `openssl rand -hex 32`
- `KEYBLOB_ENCRYPTION_KEY` — `openssl rand -hex 32` (exactly 32 bytes)
- `RELAYER_PRIVATE_KEY` — `openssl rand -hex 32` (**devnet only**)
- `RELAYER_API_KEY`, `FARM_API_KEY`, `DISTRIBUTOR_API_KEY` —
  `openssl rand -hex 32` each

Keep `ENABLE_CKB_SUBMISSION=false` unless you also fill every `CKB_*`
env var — the distributor is **fail-closed** and will simply park txs
in `Pending` without a full CKB config.

`.env.integration` is already in `.gitignore`; never commit it.

## 2. Build and start

```bash
docker compose -f docker-compose.integration.yml \
  --env-file .env.integration \
  up --build -d
```

First run takes ~8-15 min on a laptop (Rust stage dominates). Subsequent
runs hit the cargo-registry cache mount and finish in under 2 min.

## 3. Verify

Health probes should all come back `200 OK`:

```bash
for port in 3000 3001 3002 8085 8086 8087; do
  printf "%s → " "$port"
  curl -sf "http://127.0.0.1:${port}/health" && echo
done
```

Rust-service extra probes:

```bash
for port in 8085 8086 8087; do
  printf "%s readyz → " "$port"
  curl -sf "http://127.0.0.1:${port}/readyz" && echo
done
```

`/readyz` on the relayer and farm-sequencer pings both MySQL and
Redis and returns the per-dependency report. A `503` with a JSON
body like `{"redis":"down"}` tells you exactly which dep is sad.

Prometheus scrape (should dump actix-web HTTP metrics):

```bash
curl -s http://127.0.0.1:8085/metrics | head -40
```

## 4. Watch the logs for expected warnings

Without real on-chain config you should see these warnings **on
purpose** — they are the fail-closed safeguards refusing to forward
unsigned user intent to mainnet:

- `ENABLE_CKB_SUBMISSION is not set — worker will NOT broadcast …`
  (distributor)
- `CKB_RPC_URL not configured — skipping distribution cycle`
  (distributor)
- `FARM_ADMIN_ADDRESSES empty — admin routes will reject everyone`
  (farm-sequencer — if you didn't populate it)

These are **not** regressions. They mean the guards are active.

## 5. Running individual services

Up only Rust fund-critical three:

```bash
docker compose -f docker-compose.integration.yml --env-file .env.integration \
  up --build mysql redis unipass-wallet-relayer utxoswap-farm-sequencer huehub-token-distributor
```

Rebuild just one after a code change:

```bash
docker compose -f docker-compose.integration.yml --env-file .env.integration \
  up --build -d huehub-token-distributor
```

Tail one service's logs:

```bash
docker compose -f docker-compose.integration.yml logs -f unipass-wallet-relayer
```

## 6. Tear down

```bash
docker compose -f docker-compose.integration.yml down
# Wipe DB/Redis state too:
rm -rf ./data/mysql ./data/redis
```

---

## Known limitations (rehearsal vs. production)

| Topic | Rehearsal | Production |
|---|---|---|
| TLS | none (plain HTTP on host ports) | terminate at reverse proxy (Caddy/Nginx/ALB) |
| Secret management | `.env.integration` file | Vault / AWS SM / sealed secrets |
| DB backups | none | RDS snapshots / scheduled `mysqldump` |
| Metrics scraping | `curl /metrics` manual | Prometheus + Grafana (scrape targets live here) |
| Sentry | DSN optional (leave blank) | DSN required, one per service |
| On-chain submission | `ENABLE_CKB_SUBMISSION=false` (distributor parked) | flip to `true` once CKB config is audited |
| Relayer signing | test key (`openssl rand -hex 32`) | HSM-backed or KMS-wrapped key |

## Open pre-deployment blockers

Even after rehearsal passes you still need to resolve, in descending
severity:

1. **BUG-P2-C2** — `unipass-wallet-relayer` currently accepts any
   calldata from any client. It MUST verify the user's EIP-712 or
   SmartAccount signature before broadcasting. Do not run against
   real user funds until this lands. Tracked in
   `DEEP_AUDIT_SWAP_FARM_RELAYER.md`.
2. **BUG-P1-H2** — `utxoswap-farm-sequencer` `create_pool` endpoint is
   still a stub that returns `{"status":"pending"}` without doing
   anything. Same source doc.
3. **BUG-P2-H3/H4** — relayer Redis consumer spins 100 ms empty and
   `/simulate` references an unbound variable. Same source doc.

Rehearsal verifies the deployment plumbing. These bugs still require
dedicated implementation sessions before any real user onboarding.

---

## Troubleshooting

**`mysql: unhealthy` at startup.** Nuke `./data/mysql` and restart —
the first boot takes ~30 s and the healthcheck probes early.

**`pq: denied` / `connection refused` from a Rust service.** Its
`DATABASE_URL` is misconfigured. All three use the `mysql://…@mysql:3306/…`
form inside the compose network. The service prints the error once
at boot; `docker compose logs <service>` will show it.

**Rust build step fails with `error: could not find huehub-observability`.**
You're probably running `docker build` with the service directory as
context. The build context **must** be `backend-rust/` so the
relative `../huehub-observability` path resolves. Use the compose
file; don't hand-roll `docker build`.

**`YAML merge keys not allowed at…`.** You're on an ancient Docker
Compose v1. Upgrade to Compose v2 (`docker compose`, two words).
