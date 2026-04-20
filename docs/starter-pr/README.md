# Starter PRs

Concrete, pick-up-and-go templates for the two remaining impl
gaps.  Each is a single PR an engineer can land in ~3 sessions,
with acceptance criteria pinned to the already-running metrics
and alerts.

| File | Owner role | Prereq reading |
|---|---|---|
| `HIGH-FM-3-ckb-builder.md` | CKB engineer | `docs/scaffold-design.md` §HIGH-FM-3 |
| `MED-RL-3-eth-broadcaster.md` | Ethereum engineer | `docs/scaffold-design.md` §MED-RL-3 + `crates/relayer/src/nonce.rs` |

## Principles (both PRs)

1. **Keep `build()` / `broadcast()` pure enough to unit-test.**
   Scaffold tests are pure-function; yours should be too.  RPC +
   molecule/ethers + signing in one monolithic method = impossible
   to test without live infra.

2. **Don't touch the scaffold's state transitions.**  The scaffold
   owns `mark_completed` / `release` / `XACK` / etc.  You return a
   `Result` with one of the three canonical variants; the
   scaffold translates.  See the "Don'ts" section in each starter
   PR.

3. **Don't add a fourth error variant.**  The three we have
   (`NotImplemented`, `InvalidInput`, `Transient`) cover every
   real failure mode and their downstream semantics are defined
   across the whole codebase.

4. **Every new code path must land with a unit test AND an
   integration-smoke fixture.**  The unit test asserts the type
   contract; the integration test asserts the wire contract.
   Skipping either is how silent regressions ship.

5. **Observe the metrics flip.**  Each starter PR's acceptance
   criterion is that a specific Prometheus counter label moves
   (e.g. `farm_batch_result_total{result="completed"}` starts
   ticking).  You have a dashboard
   (`deploy/grafana/huehub-backends-dashboard.json`) that shows
   each of these; use it as the oracle.
