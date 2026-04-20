# E2E tests (Playwright)

Two projects:

* **`backend-contract`** — pure API-level tests asserting HTTP
  contract invariants.  Fast, runnable in CI without a browser.
  See `tests/backend-contract.spec.ts`.

* **`ui-chromium`** — UI-level tests (one file per frontend app,
  to be written).  Requires Chromium; run as a separate CI job.

## Running

```bash
pnpm install
pnpm install-browsers          # only needed for ui-chromium
FARM_BASE_URL=http://localhost:8082 \
RELAYER_BASE_URL=http://localhost:8081 \
  pnpm test --project=backend-contract
```

In the integration-smoke docker-compose stack the two services
bind to their default ports; no env override needed.

## What the backend-contract tests prove

| Invariant | Cross-ref |
|---|---|
| `/health` returns 200 | `deploy/k8s/*.yaml` `livenessProbe` |
| `/readyz` returns 200 or 503, body structured | `deploy/k8s/*.yaml` `readinessProbe`, `docs/runbook.md` §ServiceDown |
| `/metrics` exposes the scaffold metric names | `deploy/prometheus/alerts.yml`, `deploy/grafana/*.json` |
| Farm submit 503s when gate is off | `docs/deployment-rehearsal.md` §fail-closed |
| Relayer submit returns 4xx (not 5xx) on malformed input | BUG-P2-C2 regression |
| CORS preflight from bad Origin is denied | `docs/scaffold-design.md` §CORS |

If any of these fails, the corresponding alert / runbook page /
dashboard is lying.  The tests are the oracle.

## Not covered yet (stubs to write)

Per-app UI tests in `tests/ui-*.spec.ts`:

* `ui-auto-dex.spec.ts` — login → list pools → try swap
  → assert "not available for your region" fallback since we
  don't have a real wallet connector
* `ui-bomb-fun.spec.ts` — similar skeleton for the bomb-fun site
* `ui-farm-stake.spec.ts` — critical one: under
  FARM_PROCESSING_ENABLED=true + NoopBatchTxBuilder, a submitted
  deposit must surface as "Pending" in the UI, NOT "Completed".
  This is where a UI bug that showed false-success would cost
  user trust; specifically testable via Playwright.
* `ui-huehub-dex.spec.ts`
* `ui-solagram-wallet.spec.ts`
* `ui-unipass-wallet-frontend.spec.ts`

Each ~50-150 lines; deferred because they require a running
frontend build, which depends on the frontend CI path being set
up first.
