# Starter PR — MED-RL-3 Ethereum `TxBroadcaster` impl + consumer rewrite

**For:** the Ethereum engineer taking over Item 2 from
`接下来的工作.md`.

**Scope of this PR:** the minimum viable `impl TxBroadcaster`
that signs one validated meta-tx via
`SecurePrivateKey::as_bytes()` and broadcasts it on a Sepolia /
Arbitrum-Sepolia testnet, plus the `consume_once` rewrite that
routes entries through it.  Items part-1 (`NonceManager`) already
landed in `834cbcc`.

**Prereqs:**
- Read `docs/scaffold-design.md` §MED-RL-3
- Read `crates/relayer/src/nonce.rs` (already shipped, 9 tests)
- Funded testnet wallet (~0.1 ETH on Sepolia is plenty)
- Anvil available locally for unit-ish tests
  (`cargo install --git https://github.com/foundry-rs/foundry
  anvil`)

---

## Deliverables

### 1. New file: `crates/relayer/src/ethers_broadcaster.rs`

```rust
use crate::nonce::{NonceManager, NonceProvider};
use relayer_redis::broadcaster::{BroadcastError, TxBroadcaster, TxHash, TxStreamEntry};
use ethers::prelude::*;
use std::sync::Arc;

pub struct EthersBroadcaster<P: NonceProvider> {
    // Per-chain providers; key = chain_id.
    providers: HashMap<u64, Arc<Provider<Http>>>,
    signer: LocalWallet,      // built from SecurePrivateKey
    nonce_mgr: Arc<NonceManager<P>>,
}

impl<P: NonceProvider> EthersBroadcaster<P> {
    pub fn new(
        rpc_urls: HashMap<u64, String>,
        signer_key: &SecurePrivateKey,
        nonce_mgr: Arc<NonceManager<P>>,
    ) -> anyhow::Result<Self> { ... }
}

#[async_trait::async_trait]
impl<P: NonceProvider + 'static> TxBroadcaster for EthersBroadcaster<P> {
    async fn broadcast(&self, entry: &TxStreamEntry) -> Result<TxHash, BroadcastError> {
        let provider = self.providers.get(&entry.chain_id)
            .ok_or_else(|| BroadcastError::InvalidInput(
                format!("no RPC configured for chain_id {}", entry.chain_id)
            ))?;

        let signer_addr = self.signer.address();
        let nonce = self.nonce_mgr
            .next_nonce(entry.chain_id, signer_addr)
            .await
            .map_err(|e| BroadcastError::Transient(format!("nonce fetch: {e}")))?;

        let wallet_addr: Address = entry.wallet.parse()
            .map_err(|e| BroadcastError::InvalidInput(format!("bad wallet addr: {e}")))?;
        let calldata = hex::decode(entry.calldata_hex.trim_start_matches("0x"))
            .map_err(|e| BroadcastError::InvalidInput(format!("bad calldata hex: {e}")))?;

        let tx = Eip1559TransactionRequest::new()
            .to(wallet_addr)
            .data(calldata)
            .chain_id(entry.chain_id)
            .nonce(nonce)
            // Gas: use `gas_used` from validate_meta_tx upstream
            // (already recorded in the stream as of a follow-up,
            // or re-estimate via eth_estimateGas as a fallback).
            .max_fee_per_gas(gas_estimate)
            .max_priority_fee_per_gas(priority_fee);

        let signed = self.signer.sign_transaction(&tx.into()).await
            .map_err(|e| BroadcastError::InvalidInput(format!("sign: {e}")))?;

        match provider.send_raw_transaction(signed.rlp()).await {
            Ok(pending) => Ok(format!("{:?}", pending.tx_hash())),
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("nonce too low") || msg.contains("already known") {
                    // Our cache is stale.  Invalidate so the next
                    // send re-fetches from the chain.  Return
                    // Transient so the consumer Retain()s — next
                    // tick will re-try with a fresh nonce.
                    self.nonce_mgr.invalidate(entry.chain_id, signer_addr).await;
                    Err(BroadcastError::Transient(format!("nonce race: {msg}")))
                } else if msg.contains("insufficient funds") {
                    // Operator problem; not a user-input problem.
                    // Retry buys us nothing until the wallet is
                    // refunded, but Transient is still correct:
                    // we don't want to XACK this one and drop
                    // the user's tx.
                    Err(BroadcastError::Transient(format!("wallet unfunded: {msg}")))
                } else if msg.contains("invalid signature") || msg.contains("exceeds block gas limit") {
                    Err(BroadcastError::InvalidInput(msg))
                } else {
                    Err(BroadcastError::Transient(msg))
                }
            }
        }
    }
}
```

### 2. EthersNonceProvider — `crates/relayer/src/nonce.rs` (extend)

```rust
pub struct EthersNonceProvider {
    providers: HashMap<u64, Arc<Provider<Http>>>,
}

#[async_trait::async_trait]
impl NonceProvider for EthersNonceProvider {
    async fn onchain_nonce(&self, chain_id: u64, addr: Address) -> anyhow::Result<u64> {
        let provider = self.providers.get(&chain_id)
            .ok_or_else(|| anyhow::anyhow!("no RPC for chain {chain_id}"))?;
        // PENDING, not Latest — see nonce.rs module doc for why.
        let n = provider.get_transaction_count(addr, Some(BlockNumber::Pending.into())).await?;
        Ok(n.as_u64())
    }
}
```

### 3. Rewrite `crates/relayer-redis/src/lib.rs::consume_once`

```rust
async fn consume_once<B: TxBroadcaster>(
    ctx: &RelayerContext,
    broadcaster: &B,
) -> anyhow::Result<()> {
    let mut conn = ctx.redis_conn().await?;

    // 1. Ensure consumer group exists.  Idempotent.
    let _: Result<(), _> = redis::cmd("XGROUP")
        .arg("CREATE").arg(TX_STREAM_KEY).arg(TX_GROUP)
        .arg("$").arg("MKSTREAM")
        .query_async(&mut conn).await;

    // 2. XLEN gauge for operator visibility.
    let len: i64 = redis::cmd("XLEN").arg(TX_STREAM_KEY).query_async(&mut conn).await?;
    metrics::gauge!("relayer_stream_backlog").set(len as f64);

    // 3. Early return if fail-closed gate is off.
    if !consumer_is_enabled() {
        if len > 0 {
            tracing::warn!(stream = TX_STREAM_KEY, len,
                "Tx-stream has queued messages; consumer disabled.");
        }
        return Ok(());
    }

    // 4. XREADGROUP up to MAX_BATCH entries.
    let consumer_name = std::env::var("POD_NAME").unwrap_or_else(|_| "default".into());
    let reply: redis::streams::StreamReadReply = redis::cmd("XREADGROUP")
        .arg("GROUP").arg(TX_GROUP).arg(&consumer_name)
        .arg("COUNT").arg(32)
        .arg("BLOCK").arg(100)
        .arg("STREAMS").arg(TX_STREAM_KEY).arg(">")
        .query_async(&mut conn).await?;

    // 5. Parse each entry.  A parse failure becomes an
    //    EntryAction::Ack { Poisoned } in step 6.
    let mut entries = Vec::new();
    let mut poisoned = Vec::new();
    for stream in reply.keys {
        for id in stream.ids {
            let fields: Vec<(String, String)> = id.map.iter()
                .map(|(k, v)| (k.clone(), redis::from_owned_redis_value(v.clone()).unwrap_or_default()))
                .collect();
            match parse_stream_entry(&id.id, &fields) {
                Ok(entry) => entries.push(entry),
                Err(BroadcastError::InvalidInput(msg)) => {
                    poisoned.push((id.id, msg));
                }
                _ => unreachable!(),
            }
        }
    }

    // 6. Fan out.
    let actions = process_entries(broadcaster, entries).await;

    // 7. Execute: XACK for Ack, skip for Retain.  Poisoned entries
    //    from step 5 also get XACKed with an ERROR-level log.
    for (id, reason) in poisoned {
        tracing::error!(stream_id = %id, reason = %reason,
            "relayer: poisoned entry (parse failed) — XACKing to prevent redelivery");
        xack(&mut conn, &id).await?;
    }
    for action in actions {
        match action {
            EntryAction::Ack { stream_id, reason } => {
                match reason {
                    AckReason::Success(h) => tracing::info!(
                        stream_id = %stream_id, tx_hash = %h, "broadcast ok"),
                    AckReason::Poisoned(m) => tracing::error!(
                        stream_id = %stream_id, msg = %m, "poisoned, XACKing"),
                }
                xack(&mut conn, &stream_id).await?;
            }
            EntryAction::Retain { stream_id, reason } => {
                // Do NOT XACK.  Next tick re-delivers.
                match reason {
                    RetainReason::Transient(m) => tracing::warn!(
                        stream_id = %stream_id, msg = %m, "transient, will retry"),
                    RetainReason::NotImplemented(w) => tracing::debug!(
                        stream_id = %stream_id, why = %w, "not implemented, will retry"),
                }
            }
        }
    }

    Ok(())
}

async fn xack(conn: &mut deadpool_redis::Connection, id: &str) -> anyhow::Result<()> {
    let _: i64 = redis::cmd("XACK")
        .arg(TX_STREAM_KEY).arg(TX_GROUP).arg(id)
        .query_async(&mut **conn).await?;
    Ok(())
}
```

### 4. Wire in `backend-rust/unipass-wallet-relayer/src/main.rs`

```rust
let signer_key = SecurePrivateKey::from_hex(&cfg.relayer_private_key)?;
let nonce_mgr = Arc::new(NonceManager::new(EthersNonceProvider::new(rpc_urls.clone())));
let broadcaster = Arc::new(EthersBroadcaster::new(rpc_urls, &signer_key, nonce_mgr)?);

tokio::spawn({
    let ctx = ctx.clone();
    let b = broadcaster.clone();
    async move {
        loop {
            if let Err(e) = consume_once(&ctx, &*b).await {
                tracing::error!("consume_once: {e}");
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }
});
```

### 5. Integration test — Anvil

```rust
#[tokio::test]
async fn e2e_happy_path() {
    // spawn anvil, get its URL + a prefunded key
    let anvil = ethers::utils::Anvil::new().spawn();
    let rpc_url = anvil.endpoint();
    let signer_key = ...;

    // Deploy a minimal ModuleMain-shaped test contract.
    let wallet_addr = deploy_minimal_wallet(&anvil).await;

    // Construct the broadcaster.
    let nonce_mgr = Arc::new(NonceManager::new(EthersNonceProvider::new(
        HashMap::from([(anvil.chain_id(), Arc::new(provider))])
    )));
    let bc = EthersBroadcaster::new(...).unwrap();

    // Craft a valid TxStreamEntry.
    let entry = TxStreamEntry {
        stream_id: "1-0".into(),
        chain_id: anvil.chain_id(),
        wallet: format!("{:?}", wallet_addr),
        calldata_hex: "0x...".into(),
    };

    let tx_hash = bc.broadcast(&entry).await.unwrap();
    // Wait one block.
    // Assert the tx landed: provider.get_transaction_receipt(hash).await?.is_some()
}
```

### 6. Tests for the consume_once rewrite

Put these in `crates/relayer-redis/tests/consume_integration.rs`
and require a Redis sidecar:

- happy path: XADD a valid entry → consume_once with a
  `ScriptedBroadcaster::ok(...)` → assert XPENDING empty
- poison path: XADD a malformed entry (missing chain_id) →
  consume_once with NoopTxBroadcaster → assert XPENDING empty
  AND an error log was emitted mentioning the stream_id
- transient path: XADD a valid entry → consume_once with
  ScriptedBroadcaster returning Transient → assert XPENDING
  STILL HAS the entry (not XACKed)
- noimpl path: XADD a valid entry → consume_once with
  NoopTxBroadcaster → assert XPENDING still has it

---

## Don'ts

- **Don't skip the `invalidate()` on `nonce too low`.**  Documented
  in `nonce.rs` module doc's "Failure model" section.  Skipping
  it causes cascading queue-jam; every subsequent send fails with
  the same error.
- **Don't XACK on `retain_transient`.**  The
  `transient_yields_retain_not_ack` unit test in
  `relayer-redis::broadcaster` pins this invariant — it's the
  "never silently drop a tx" guard.
- **Don't use `BlockNumber::Latest` for the nonce fetch.**
  Our own in-flight tx may not have mined yet; Latest would
  hand us a colliding nonce.  Use `Pending`.
- **Don't store `RELAYER_PRIVATE_KEY` anywhere besides a
  Vault / HSM / Fireblocks** in production.  The
  `SecurePrivateKey` wrapper zeroes on drop and has no Debug /
  Clone impls — keep it that way.  The `.env.integration`
  example value is for local dev only.
- **Don't add a fourth `BroadcastError` variant.**  Load-bearing
  across the scaffold; see `docs/scaffold-design.md`.

## Estimated effort

- EthersBroadcaster skeleton + signer: 1 session
- Nonce manager + error mapping: 0.5 session (mostly glue)
- consume_once rewrite: 0.5 session
- Anvil fixture + e2e test: 1 session

**Acceptance:**
- `relayer_entry_result_total{result="ack_success"}` ticks up
  on the integration-smoke dashboard
- A submitted meta-tx appears on the testnet within one tick
  (~500ms)
- Killing the testnet RPC mid-test causes
  `retain_transient` to tick; restoring it drains the backlog
