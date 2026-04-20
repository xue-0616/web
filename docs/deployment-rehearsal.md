# Deployment Rehearsal — 7 Fund-Critical Services

**Goal:** stand up the three hardened Node backends and four hardened
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
| 8080 | `utxo-swap-sequencer` (Rust) | CKB UTXOSwap mediator; serves `/api/v1/configurations` |
| 8085 | `unipass-wallet-relayer` (Rust) | EVM meta-tx relayer |
| 8086 | `utxoswap-farm-sequencer` (Rust) | CKB farm sequencer |
| 8087 | `huehub-token-distributor` (Rust) | CKB xUDT distributor |

All seven services expose `/health` (legacy). `unipass-wallet-relayer`
and `utxoswap-farm-sequencer` additionally expose `/healthz`,
`/readyz`, and `/metrics` (Prometheus exposition format) from the
shared `huehub-observability` crate. `utxo-swap-sequencer` ships a
plain `/health` only — it doesn't depend on the observability crate.

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
for port in 3000 3001 3002 8080 8085 8086 8087; do
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

### Guardrail smoke (rounds 5–6 fail-closed contract)

Once the stack is healthy, run:

```bash
bash scripts/guardrail-smoke.sh                 # default ports
SKIP_SWAP=1 bash scripts/guardrail-smoke.sh     # skip the swap-seq block
```

The script probes each fail-closed endpoint and asserts the expected
HTTP code from §4a / §4b (501 for stubs, 503 for disabled gates, 401
for auth-guarded routes called without credentials). It exits 0 on
pass and non-zero on any real regression — stub endpoints silently
returning 200, or 500s where the contract says 503, will fail here.

With the full compose stack up, expect **10/10 pass, 0 skipped**.
`SKIP_SWAP=1` is available for running the script against a bare
relayer + farm-seq environment (it drops the 6 swap-seq
assertions but still validates the farm-seq fail-closed contract).

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
- `FARM_PROCESSING_ENABLED=false — pools manager loop is parked`
  (farm-sequencer — the pools manager returns early when unset; the
  submit-create-pool and submit-intent endpoints return **503** with
  an explanatory body so clients don't silently lose LP tokens)
- `RELAYER_CONSUMER_ENABLED=false — running in fail-loud stub mode`
  (relayer — see below). Flipping this to `true` **without** a real
  signing pipeline will make the consumer loop `anyhow::bail!` on
  every non-empty stream length; that's intentional.
- `GET /configurations: missing required deployment env vars: […]`
  (swap-sequencer — the endpoint now returns **503** listing the
  unset vars if any of the on-chain deployment hashes are missing;
  clients that used to get "" back and crash now get a documented
  `serviceUnavailable` instead)

These are **not** regressions. They mean the guards are active.

## 4a. Security / guardrail env vars (round 5-6 additions)

All of these default to the safest value and are **optional** —
rehearsal will run with none of them set. Set them only when you
intentionally want to change the behaviour.

| Env var | Default | What it gates |
|---|---|---|
| `FARM_PROCESSING_ENABLED` | `false` | Farm sequencer pools-manager loop + submit-intent + submit-create-pool (fail-closed, returns 503 while `false`). Flip to `true` only after the real CKB batch-tx builder (HIGH-FM-3) lands. |
| `RELAYER_CONSUMER_ENABLED` | `false` | Relayer Redis-stream consumer. `false` = observe-only stub (WARN-logs backlog). `true` without the full signing pipeline will `bail!` on non-empty streams by design — don't set `true` yet. |
| `PRICE_ORACLE_MIN_USD_LIQUIDITY` | `1000` | Pool USD-value floor below which the swap-sequencer's price oracle will ignore a pool when deriving token prices (MED-SW-5). Negative values are rejected (falls back to default). `0` disables the gate entirely — test envs only. |
| `SEQUENCER_LOCK_CODE_HASH` | *(unset → 503 on `/configurations`)* | One of the five deployment hashes the swap-sequencer serves to the frontend. Unset = `/api/v1/configurations` returns 503 listing which vars are missing. |
| `SEQUENCER_LOCK_ARGS` | *(unset → 503)* | As above. |
| `POOL_TYPE_CODE_HASH` | *(unset → 503)* | As above. |
| `CONFIGS_CELL_TYPE_HASH` | *(unset → 503)* | As above. |
| `DEPLOYMENT_CELL_TYPE_HASH` | *(unset → 503)* | As above. |
| `SEQUENCER_LOCK_HASH_TYPE` | `1` (type) | Numeric hash_type the sequencer lock script uses. |
| `SWAP_FEE_BPS` | `30` (0.30%) | Surfaced via `/configurations` so the frontend fee preview cannot drift from the batcher. |
| `MIN_LIQUIDITY` | `1000` | First-LP lockup units. UI parity only; batcher enforcement lives in the pool contract. |
| `MAX_INTENTS_PER_BATCH` | `50` | Advisory, exposed for UI queue-depth hints. |
| `BATCH_INTERVAL_MS` | `3000` | Advisory. |
| `APOLLO_URL` | *(unset → env-only config)* | Relayer. When set, Apollo overrides a narrow allow-list of fields (RPC URLs, port, slack webhook). **Reserved** fields that Apollo may NOT override: `relayer_private_key`, `database_url`, `redis_url`, `apollo_url`, `secret_path`. Attempts are logged at WARN and ignored. |

## 4b. Status-code contract (MED-SW-1 / SW-2)

The Rust services now distinguish three non-5xx failure modes,
which matters for monitoring rules — don't page on 501/503, do page
on 500:

| Code | Meaning | Typical cause | Fix |
|---|---|---|---|
| **501 Not Implemented** | Endpoint route exists but handler isn't wired up yet | `add_liquidity`, `remove_liquidity`, `swap_input_for_exact_output`, `create_pool` on the swap-seq | Wait for the feature PR; don't alert |
| **503 Service Unavailable** | Code is fine, ops has work to do | `FARM_PROCESSING_ENABLED=false`, `/configurations` with missing deployment hashes | Set the missing env var and redeploy |
| **500 Internal** | Actual bug | panicked handler, unexpected DB error | Page on-call |

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

As of round 6 of the deep-audit remediation, **every CRIT and HIGH
security item is closed** and every MED is closed. What remains is
functional work, not security work:

1. ~~**BUG-P2-C2 / CRIT-RL-2** — relayer meta-tx pipeline~~ **FIXED**
   (round 2). 4-stage pipeline:
   parse → structural validate (reject delegate_call, cap inner-tx
   count at 32) → Redis replay-claim `(chainId, wallet, nonce)` →
   on-chain `eth_call` simulation. 25 unit tests.
2. ~~**BUG-P1-H2 / HIGH-FM-3** — farm-seq unauthenticated
   `create_pool` stub~~ **FIXED** (round 3-5). Admin allow-list +
   signature verification + duplicate-pool guard (MED-FM-3). The
   **real CKB batch-tx builder** that would let the pools-manager
   loop actually process intents is the remaining functional piece;
   guarded by `FARM_PROCESSING_ENABLED=false` until it lands, so no
   user LP tokens can get stuck in the meantime.
3. ~~**BUG-P2-H3 — relayer `/simulate` unbound variable**~~ **FIXED**
   (round 2).
4. ~~**BUG-P2-H4 / MED-RL-3** — relayer Redis consumer spin-loop~~
   **FIXED** (round 6). Fail-loud stub with the
   `RELAYER_CONSUMER_ENABLED` gate. Real signing pipeline TODO.

### Functional gaps that still need implementation sessions

**Each has a scaffold already landed on `origin/main` — the trait,
error taxonomy, pure selector/parser, atomic state machine, and
handler wiring are done. See `docs/scaffold-design.md` for the
one-page "what you still need to write" guide.** The bullets below
point at the chain-specific piece the scaffold doesn't own.

- **CKB batch-tx builder** — `impl BatchTxBuilder` for the
  `utxoswap-farm-sequencer` service. Scaffold seam is
  `crates/utils/src/pools_manager/batch_tx_builder.rs`; wiring is
  `process_farm_intents_with_builder` in `pools_handler/handler.rs`.
  Needs: molecule deserialization of the pool cell, tx assembly,
  CKB signing + broadcast. Gated by `FARM_PROCESSING_ENABLED=false`
  until you plug in a real builder; `NoopBatchTxBuilder` makes the
  scaffold inert for testing.
- **Relayer signing pipeline** — `impl TxBroadcaster` for the
  `unipass-wallet-relayer` service, plus two wiring PRs:
  (a) XADD push from `POST /transactions/relay`, and (b) rewrite
  `consume_once` to call `process_entries` and honour the returned
  `Vec<EntryAction>`. Scaffold seam is
  `crates/relayer-redis/src/broadcaster.rs`. Gated by
  `RELAYER_CONSUMER_ENABLED=false`; `NoopTxBroadcaster` keeps the
  scaffold inert.
- **Integration tests with live sidecars** (MySQL, Redis, CKB) —
  the per-PR gate today is unit-only; a scheduled integration job
  that stands up the compose file and exercises the happy paths
  would catch wiring regressions the unit tests miss.
- **Frontend Playwright E2E** — no automated coverage of the six
  frontend apps against the hardened backends.

Rehearsal verifies the deployment plumbing and the fail-closed
gates. The four items above are what's left before a real user
onboarding.

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
