# Starter PR — HIGH-FM-3 CKB `BatchTxBuilder` impl

**For:** the CKB engineer taking over Item 1 from
`接下来的工作.md`.

**Scope of this PR:** the minimum viable `impl BatchTxBuilder`
that drives one real farm-pool batch through to `mark_completed`
on a CKB devnet.  Follow-ups (multi-intent dedup, reorg handling,
fee estimation) are out of scope and tracked separately.

**Prereqs:** docs/scaffold-design.md §HIGH-FM-3 (read first),
CKB devnet running, `ckb-cli` or SDK configured.

---

## Deliverables

### 1. New file: `crates/utils/src/pools_manager/ckb_batch_tx_builder.rs`

```rust
use super::batch_tx_builder::{BatchTxBuilder, BuildError, TxHash};
use ckb_jsonrpc_types as rpc;
use ckb_types::{core::TransactionView, packed, prelude::*};

pub struct CkbBatchTxBuilder {
    rpc_url: String,
    signer: Arc<SecurePrivateKey>,
    farm_script: packed::Script,
    // ... other config
}

impl CkbBatchTxBuilder {
    pub fn from_ctx(ctx: &AppContext) -> Self { ... }

    async fn fetch_pool_cell(&self) -> Result<packed::CellOutput, BuildError> {
        // Use rpc::get_live_cell against the farm's type script.
        // NotFound → InvalidInput.  RPC timeout → Transient.
    }

    async fn fetch_intent_cells(
        &self,
        claimed_ids: &[u64],
    ) -> Result<Vec<packed::CellOutput>, BuildError> {
        // Each claimed intent has a (cell_tx_hash, cell_index)
        // stored in farm_intents.  Resolve to live cells.
    }
}

#[async_trait::async_trait]
impl BatchTxBuilder for CkbBatchTxBuilder {
    async fn build(
        &self,
        _pool_cell_data: &[u8],   // placeholder — we re-fetch live
        _intent_cells: &[Vec<u8>], // placeholder — we re-fetch live
    ) -> Result<TxHash, BuildError> {
        let pool_cell = self.fetch_pool_cell().await?;
        let intents = self.fetch_intent_cells(...).await?;

        // 1. Deserialize pool cell data via molecule.
        //    InvalidInput on length mismatch / schema violation.
        let pool = FarmPoolCellData::from_slice(pool_cell.data().as_slice())
            .map_err(|e| BuildError::InvalidInput(format!("pool cell decode: {e}")))?;

        // 2. Apply each intent to pool accumulator.
        let new_pool = apply_intents(pool, &intents)?;

        // 3. Build transaction.
        let tx = TransactionView::new_advanced_builder()
            .cell_deps(self.required_cell_deps())
            .inputs(input_cells)
            .outputs(output_cells)
            .outputs_data(outputs_data)
            .witness(signed_witness)
            .build();

        // 4. Broadcast.
        match self.rpc_send_tx(&tx).await {
            Ok(hash) => Ok(hash.as_bytes().to_vec()),
            Err(e) if e.is_timeout() => Err(BuildError::Transient(e.to_string())),
            Err(e) => Err(BuildError::InvalidInput(e.to_string())),
        }
    }
}
```

### 2. Unit tests — `#[cfg(test)] mod tests` in the same file

MUST cover:

- **molecule_deserialize_round_trips** — serialize a known-good
  `FarmPoolCellData`, pass the bytes through `from_slice`, assert
  equality.
- **malformed_pool_data_rejects_as_invalid_input** — feed
  truncated / wrong-schema bytes, assert
  `BuildError::InvalidInput`.
- **empty_intents_returns_unchanged_pool** — `apply_intents(pool,
  &[])` must leave the accumulator untouched.
- **one_deposit_advances_accumulator** — single deposit intent,
  assert `acc_reward_per_share` advances by the right amount
  (use a pure `solve_batch` helper and call it from both the
  builder and a test — this mirrors the existing `intent-solver`
  unit tests).
- **rpc_timeout_maps_to_transient** — mock the RPC to time out,
  assert `BuildError::Transient`.
- **rpc_rejects_with_cell_conflict_maps_to_transient** — reorg
  racing: the intent cell we tried to consume was already
  consumed by someone else.  Next tick will re-query, so this is
  Transient (NOT InvalidInput).

### 3. Wiring — `crates/utils/src/pools_manager/manager.rs`

Replace:
```rust
let builder = NoopBatchTxBuilder;
```
with:
```rust
let builder = CkbBatchTxBuilder::from_ctx(&ctx);
```

Thread the `Arc<SecurePrivateKey>` and RPC URL through
`AppContext` if they aren't already (check `src/main.rs`).

### 4. Integration fixture — `.github/workflows/integration-smoke.yml`

Add a sidecar service:
```yaml
services:
  ckb-dev:
    image: nervos/ckb:0.116.0-rc1
    args: ["--dev"]
    ports: ["8114:8114"]
```

Add a test step:
```yaml
- name: farm-seq e2e drain
  run: |
    # Pre-deploy the farm script + seed the pool cell.
    ./scripts/fixture-farm-devnet.sh

    # Seed a pending row.
    mysql ... << 'EOF'
      INSERT INTO farm_intents (...) VALUES (...);
    EOF

    # Flip the gate.
    kubectl set env deploy/farm-sequencer FARM_PROCESSING_ENABLED=true
    # or for docker-compose: docker compose exec -e FARM_PROCESSING_ENABLED=true ...

    # Poll.
    for i in 1..60; do
      status=$(mysql -sN -e "SELECT status FROM farm_intents WHERE id=1")
      [[ "$status" == "Completed" ]] && exit 0
      sleep 3
    done
    exit 1  # timed out
```

### 5. Verify the metrics flip

With the real builder running, run `curl <pod>/metrics | grep
farm_batch_result_total` — the `completed` label should tick up
for every successful build.  This is what flips the Grafana
dashboard's "Batch result throughput" panel from all-blue
(`released_notimpl`) to green (`completed`).

---

## Don'ts

- **Don't skip the `fetch_*` + `apply_intents` separation.**  The
  scaffold's tests are pure-function; yours should be too.  A
  monolithic `build()` that mixes RPC + molecule + signing is
  impossible to unit-test.
- **Don't call `mark_completed` / `release` from inside
  `build()`.**  The scaffold's `process_farm_intents_with_builder`
  owns state transitions.  Your `build()` returns a `Result`;
  the scaffold translates.
- **Don't add a fourth `BuildError` variant.**  The three we
  have have defined semantics at the scaffold layer; see
  `docs/scaffold-design.md`.
- **Don't bump `FARM_MAX_BATCH_SIZE` above 50 without widening
  the `FarmBatchBuildSlow` alert threshold.**  Cross-linked
  with `deploy/prometheus/alerts.yml`.

## Estimated effort

- Skeleton + molecule parser: 1 session
- Real tx assembly + signing: 1 session
- Integration fixture + test-green: 1 session

**Acceptance:**  `farm_batch_result_total{result="completed"}`
ticks up in the integration-smoke dashboard, and the seeded row
transitions to `Completed` within one 3-second tick.
