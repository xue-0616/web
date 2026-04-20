# Scaffold design notes — HIGH-FM-3 + MED-RL-3

**Audience:** whoever is writing the real CKB batch-tx builder or
the real Ethereum signing / broadcasting pipeline.

**TL;DR:** the scaffold already owns every concern except the
chain-specific bit. You plug in one `impl BatchTxBuilder` /
`impl TxBroadcaster`; the rest of the pipeline — ordering,
deduplication, atomic claim, XACK discipline, error recovery — is
already done, tested, and audit-tracked. Don't re-invent it.

This doc is short on purpose. The scaffold is the source of truth;
this file just points at the seams.

---

## Why the pattern exists

Both services (`utxoswap-farm-sequencer`, `unipass-wallet-relayer`)
hit the same structural problem during the round-1–4 deep audit:

- A user-facing submit endpoint (`POST /intents/submit`, `POST
  /transactions/relay`) persists work into a backing store (MySQL
  for farm, Redis stream for relayer).
- A background loop drains that store into on-chain
  transactions.
- The drainer was a stub that silently returned success every
  tick. User work piled up invisibly, no logs, no metrics, no
  alerts, until someone noticed their deposit never landed.

The round-5–10 scaffold replaces the stubs with a well-shaped
**pipeline with one plug-in point**: the chain-specific builder /
broadcaster. Everything else — selecting which work to attempt,
protecting against double-processing, classifying failures,
deciding whether to retry — is shared and tested.

---

## The shared vocabulary

Both services use the same three-variant error enum:

```rust
enum BuildError  { NotImplemented(&'static str), InvalidInput(String), Transient(String) }
enum BroadcastError { NotImplemented(&'static str), InvalidInput(String), Transient(String) }
```

The recovery semantics are identical and **not negotiable**:

| Variant | farm-seq action | relayer action | Why |
|---|---|---|---|
| `NotImplemented` | `release` (Processing → Pending) | `Retain` (no XACK) | Noop path — real impl not yet wired. Next tick retries. |
| `InvalidInput` | `mark_failed` + JSON reason | `Ack(Poisoned)` + log | Malformed work. Retries never succeed. Don't wedge the queue. |
| `Transient` | `release` | `Retain` (no XACK) | Infra flake. Retries will likely succeed. |
| `Ok(_)` | `mark_completed` + tx hash | `Ack(Success)` + tx hash | Happy path. Terminal state. |

If you find yourself wanting a fifth variant, stop. The existing
three cover every real failure mode we've seen; adding variants
means the caller's match becomes non-exhaustive and the XACK /
state-transition correctness proof gets longer.

---

## HIGH-FM-3 — farm-seq batch-tx builder

### What you need to provide

One impl of this trait:

```rust
// crates/utils/src/pools_manager/batch_tx_builder.rs
#[async_trait::async_trait]
pub trait BatchTxBuilder: Send + Sync {
    async fn build(
        &self,
        pool_cell_data: &[u8],
        intent_cells: &[Vec<u8>],
    ) -> Result<TxHash, BuildError>;
}
```

`TxHash` is `Vec<u8>` (opaque — the caller hex-encodes as needed).

Your job inside `build`:

1. Deserialize `pool_cell_data` via `molecule` into the farm pool's
   on-chain struct. Bail `InvalidInput` on a length mismatch.
2. For each `&intent_cells[i]`, deserialize the intent cell data
   (deposit / withdraw / harvest / etc.) and update pool accumulator
   accordingly.
3. Build a CKB `Transaction` that consumes the intent cells as
   inputs and produces a new pool cell. Use `ckb-types` v0.116 —
   already a workspace dep.
4. Sign, broadcast via CKB RPC (`send_transaction`), and return the
   resulting tx hash on `Ok`.

Anything transient (CKB RPC timeout, mempool rejection because of
cell-dep race) → `BroadcastError::Transient`. Anything structurally
wrong → `BroadcastError::InvalidInput`.

### What you do NOT need to worry about

- **Which rows to process** — `select_next_batch` already enforces
  FIFO by `created_at`, dedups on `(cell_tx_hash, cell_index)`, and
  caps at the configured batch size. 8 unit tests cover edge cases.
- **Concurrent workers grabbing the same rows** — `intent_state_machine::claim` uses a single
  `UPDATE ... WHERE status=Pending` which is atomic on MySQL's
  default isolation. 5 unit tests assert the SQL shape.
- **Mapping failures to terminal state** — `process_farm_intents_with_builder` has an
  exhaustive match on your `Result`, covered by the shared
  vocabulary table above.
- **Fail-closed gate** — `FARM_PROCESSING_ENABLED=false` is the
  default. The submit endpoint returns 503 and the loop is idle
  until an operator explicitly turns you on.

### Where to plug in

```rust
// backend-rust/utxoswap-farm-sequencer/src/main.rs
// (currently: no builder is constructed; loop uses legacy
// process_farm_intents stub)

let builder = MyRealBatchTxBuilder::new(ckb_rpc_url, signer);
// pass &builder into manager::start and it forwards to
// process_farm_intents_with_builder per-farm.
```

`NoopBatchTxBuilder` exists as the zero-risk default so anyone
can flip `FARM_PROCESSING_ENABLED=true` against the current tree
and verify the pipeline wiring works end-to-end (loop runs,
claim fires, release fires, nothing is ever marked Completed).

### Integration-test seam

Once your impl builds, the `integration-smoke` CI workflow
(`.github/workflows/integration-smoke.yml`) brings up live MySQL +
Redis + the farm-seq service. Add a test fixture:

1. Seed a `farm_intents` row with `status=Pending`.
2. Set `FARM_PROCESSING_ENABLED=true` for the container.
3. Poll until the row transitions out of Pending.
4. Assert final `status` matches what your builder returned.

Don't attempt unit tests against real sea-orm — enabling the
`mock` feature breaks `Clone` on `DatabaseConnection` which
cascades to `AppContext` (see the trailer comment at the bottom
of `pools_handler/handler.rs`).

---

## MED-RL-3 — relayer signing + broadcasting

### What you need to provide

One impl of this trait:

```rust
// crates/relayer-redis/src/broadcaster.rs
#[async_trait::async_trait]
pub trait TxBroadcaster: Send + Sync {
    async fn broadcast(&self, entry: &TxStreamEntry)
        -> Result<TxHash, BroadcastError>;
}
```

`TxHash` here is `String` (0x-prefixed hex, because the consumer
logs it and we want to avoid an ethers-types dep in the
classification layer).

Your job inside `broadcast`:

1. Take `entry.wallet` + `entry.calldata_hex` + `entry.chain_id`.
2. Look up the nonce for the relayer's own EOA on that chain
   (nonce manager). You can use in-memory + `eth_getTransactionCount`
   fallback.
3. Build an EIP-1559 transaction calling the wallet's `execute`
   method with the provided calldata. Gas estimate already done by
   the `validate_meta_tx` flow upstream; you can accept it as-is
   or add a safety buffer.
4. Sign with `SecurePrivateKey::as_bytes()` — this method is
   already `#[allow(dead_code)]`'d exactly because it's waiting
   for you (`backend-rust/unipass-wallet-relayer/src/security.rs`).
5. `eth_sendRawTransaction`. On success return the tx hash.
6. Map errors:
   - `nonce too low` / `already known` → probably we already
     broadcast this entry in a prior tick. Return `Ok(hash)` if
     you can recover it, otherwise `Transient`.
   - `execution reverted` after simulation passed → bug, but
     `Transient` is the safer choice (re-simulate + retry).
   - Anything that changes the request semantics if you retry
     (bad signature, wrong chain id, obvious calldata corruption)
     → `InvalidInput`.

### What you do NOT need to worry about

- **Stream entry parsing** — `parse_stream_entry` already rejects
  anything malformed (missing fields, non-hex, wrong address
  length) with `InvalidInput`. 7 unit tests cover edge cases.
- **XACK discipline** — `process_entries` maps each
  `BroadcastError` variant to the right `EntryAction`. The
  consumer (a future PR, see below) walks the returned
  `Vec<EntryAction>` and XACKs only the `Ack` variants.
- **The 'silently drop on Transient' trap** — the
  `transient_yields_retain_not_ack` test is a load-bearing
  regression guard. If you edit `process_entries` and break that
  invariant you'll know immediately.
- **Fail-closed gate** — `RELAYER_CONSUMER_ENABLED=false` is the
  default. The current `consume_once` observes stream length via
  `XLEN` and emits a WARN-level log when the backlog is non-zero;
  it does NOT drain. Flipping to `true` without your impl just
  makes the loud backlog log a bit louder.

### Where to plug in

Two places:

1. **API push** — `POST /transactions/relay` validates the
   meta-tx then currently logs
   `// TODO: push onto Redis stream for async broadcast.`. Implement
   that XADD so entries actually enter the stream. Schema must
   match what `parse_stream_entry` expects: `chain_id` as decimal
   string, `wallet` as `0x + 40 hex`, `calldata_hex` as `0x + even
   hex`.

2. **Consumer rewrite** — `consume_once` in
   `crates/relayer-redis/src/lib.rs` needs to flip from
   XLEN-observation mode to:

   ```text
   if !consumer_is_enabled() { XLEN-observe as today; return }

   XGROUP CREATE MKSTREAM (idempotent)
   entries = XREADGROUP ... BLOCK 100ms COUNT max_batch
   parsed  = entries.map(parse_stream_entry)
   actions = process_entries(&broadcaster, parsed)
   for action in actions {
       match action {
           Ack { stream_id, .. } => XACK(stream_id),
           Retain { .. }         => skip (stays in PEL),
       }
   }
   ```

   The `parse_stream_entry` failures become
   `EntryAction::Ack { reason: AckReason::Poisoned(_) }` directly
   — you do NOT want to leave unparseable entries in the PEL
   forever.

### Integration-test seam

Same integration-smoke workflow. Fixture:

1. `XADD relayer:tx_stream` a well-formed entry.
2. Set `RELAYER_CONSUMER_ENABLED=true` for the container.
3. Poll `XPENDING relayer:tx_stream relayer_workers` until count
   is zero (meaning the consumer XACKed).
4. Assert the expected `eth_sendRawTransaction` was observed (a
   mock RPC or a spy-capture on the test CKB/Anvil node).

---

## Status

As of `origin/main`:

| Piece | Status | Commit |
|---|---|---|
| farm-seq trait + pure selector + Noop | ✅ | `731eea2` |
| farm-seq atomic state machine + SQL tests | ✅ | `5eae9ce` |
| farm-seq handler wiring | ✅ | `26b0bbb` |
| relayer trait + parser + Noop | ✅ | `73641ec` |
| relayer per-entry classifier + tests | ✅ | `8e38c42` |
| farm-seq real CKB `impl BatchTxBuilder` | ⏳ — this doc | — |
| relayer real `impl TxBroadcaster` | ⏳ — this doc | — |
| relayer API XADD push | ⏳ | — |
| relayer `consume_once` rewrite | ⏳ | — |

## Don't

- Don't add a fourth error variant "just for this case". The
  three we have cover every case the downstream XACK / MySQL
  UPDATE layer knows how to handle. A fourth variant with
  undefined semantics at the downstream layer is a silent
  double-spend waiting to happen.
- Don't call the stream drain / DB UPDATE code from inside your
  trait impl. The scaffold owns that. Your impl returns a
  `Result` and the scaffold translates it.
- Don't skip the integration-smoke fixture for your impl. The
  unit-test coverage on the scaffold is strong (30+ tests across
  both services) but a real impl needs a real-DB/real-Redis
  regression to catch issues the scaffold can't see (sea-orm
  transaction behaviour, Redis consumer group edge cases).
