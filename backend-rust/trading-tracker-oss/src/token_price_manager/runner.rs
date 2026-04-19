//! `TokenPriceRunner` — owns the substreams stream, dispatches each message
//! to the right DEX parser, and broadcasts price updates to jsonrpsee
//! subscribers via a `tokio::sync::broadcast` channel.
//!
//! Matches the closed-source
//! `token_price_manager::runner::TokenPriceRunner` exports:
//!   * `deal_substream` (top-level loop)
//!   * `deal_msg` (per-message handler)

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use futures::StreamExt;
use prost::Message;
use solana_pubkey::Pubkey;
use tokio::sync::broadcast;

use crate::{
    config::{PoolConfig, TradingTrackerNode},
    cursor_store::CursorStore,
    dex_pool::{DexPool, PoolPrice},
    error::DexautoTrackerError,
    package,
    pb::sf::{
        solana::dex::trades::v1::Output,
        substreams::rpc::v2::{BlockScopedData, Request},
    },
    token_price_manager::{
        substreams::SubstreamsEndpoint, substreams_stream::SubstreamsEvent,
    },
};

/// Broadcast channel capacity — enough to buffer a few seconds of blocks
/// worth of updates before slow subscribers cause lag warnings.
const BROADCAST_CAPACITY: usize = 4096;

pub struct TokenPriceRunner {
    endpoint: SubstreamsEndpoint,
    node: TradingTrackerNode,
    start_block: u64,
    cursors: CursorStore,
    pools: Mutex<HashMap<Pubkey, DexPool>>,
    price_cache: Mutex<HashMap<Pubkey, PoolPrice>>,
    tx: broadcast::Sender<PoolPrice>,
}

impl TokenPriceRunner {
    pub fn new(
        endpoint: SubstreamsEndpoint,
        node: TradingTrackerNode,
        start_block: u64,
        cursors: CursorStore,
        initial_pools: Vec<PoolConfig>,
    ) -> Result<Arc<Self>, DexautoTrackerError> {
        let mut pools = HashMap::new();
        for p in initial_pools {
            let dp = DexPool::new(p.kind, p.address, p.mint_a, p.mint_b);
            let dp = if let Some(bc) = p.bonding_curve {
                dp.with_bonding_curve(bc)
            } else {
                dp
            };
            pools.insert(p.address, dp);
        }
        let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        Ok(Arc::new(Self {
            endpoint,
            node,
            start_block,
            cursors,
            pools: Mutex::new(pools),
            price_cache: Mutex::new(HashMap::new()),
            tx,
        }))
    }

    /// Subscribers (jsonrpsee RPC `subscribe_token_price`) attach here.
    pub fn subscribe(&self) -> broadcast::Receiver<PoolPrice> {
        self.tx.subscribe()
    }

    /// Public: dynamically add a pool to the track set. Invoked by the
    /// RPC `add_pool` method.
    pub fn add_pool(&self, cfg: PoolConfig) -> Result<(), DexautoTrackerError> {
        let mut pools = self.pools.lock().unwrap();
        if pools.contains_key(&cfg.address) {
            return Err(DexautoTrackerError::PoolAlreadyTracked(cfg.address.to_string()));
        }
        let mut dp = DexPool::new(cfg.kind, cfg.address, cfg.mint_a, cfg.mint_b);
        if let Some(bc) = cfg.bonding_curve {
            dp = dp.with_bonding_curve(bc);
        }
        pools.insert(cfg.address, dp);
        Ok(())
    }

    /// Snapshot of the current live price for a given pool (if any).
    pub fn latest_price(&self, pool: &Pubkey) -> Option<PoolPrice> {
        self.price_cache.lock().unwrap().get(pool).cloned()
    }

    /// Build the `Request` template the stream will clone for each reconnect.
    /// The `modules` field is taken from the `.spkg` package; the cursor is
    /// injected by the stream itself from `CursorStore`.
    async fn build_request(&self) -> Result<Request, DexautoTrackerError> {
        let pkg = package::load(&self.node.package).await?;
        // Validate the output_module is present — surfaces a clear error
        // early instead of a cryptic server-side rejection later.
        package::pick_output_module(&pkg, &self.node.module)?;
        Ok(Request {
            start_block_num: self.start_block as i64,
            start_cursor: String::new(), // set by stream from CursorStore
            stop_block_num: 0,            // 0 = follow head forever
            final_blocks_only: false,
            production_mode: true,
            output_module: self.node.module.clone(),
            modules: pkg.modules,
            ..Default::default()
        })
    }

    /// Top-level substreams consumer loop.
    ///
    /// Mirrors the closed-source `deal_substream`: open the stream, pump
    /// every `SubstreamsEvent` into `deal_msg`, persist the cursor after each
    /// successfully-handled block. The inner `SubstreamsStream` handles
    /// reconnection transparently, so this loop only terminates on a
    /// fatal (non-recoverable) error — matching the observed "stay up
    /// forever" behaviour of the ELF.
    pub async fn deal_substream(self: Arc<Self>) -> Result<(), DexautoTrackerError> {
        let request = self.build_request().await?;
        tracing::info!(
            endpoint = %self.endpoint.uri,
            module = %self.node.module,
            start_block = self.start_block,
            "starting substreams consumer",
        );

        let mut stream = super::substreams_stream::new(
            self.endpoint.clone(),
            request,
            self.cursors.clone(),
        );

        while let Some(event) = stream.next().await {
            match event {
                Ok(ev) => {
                    if let Err(e) = self.deal_msg(ev).await {
                        // Per-message errors (bad instruction, parser failure)
                        // must NOT kill the runner — log and continue.
                        tracing::error!(error = ?e, "deal_msg error");
                    }
                }
                Err(e) => {
                    // Stream-level errors are already logged by the stream
                    // itself; only fatal server errors reach us here.
                    tracing::error!(error = ?e, "substreams stream fatal");
                    return Err(e);
                }
            }
        }

        // Stream ended cleanly (server closed with no error) — surface as an
        // error so `main` can decide whether to restart the process.
        Err(DexautoTrackerError::Substreams(
            "substreams stream ended unexpectedly".into(),
        ))
    }

    /// Handle a single substreams event. Session 3 will decode the protobuf
    /// `MapModuleOutput` payload into `DexTradeData` + run the DEX parsers.
    pub async fn deal_msg(
        self: &Arc<Self>,
        event: SubstreamsEvent,
    ) -> Result<(), DexautoTrackerError> {
        match event {
            SubstreamsEvent::BlockData(block) => {
                let cursor = block.cursor.clone();
                let fbh = block.final_block_height;
                let block_num = block.clock.as_ref().map(|c| c.number).unwrap_or(0);
                self.handle_block(block).await?;
                // Persist cursor only AFTER successful handling — this is the
                // exactly-once guarantee: a crash inside handle_block replays
                // this block on restart.
                self.cursors.save(&cursor, fbh, block_num)?;
                Ok(())
            }
            SubstreamsEvent::Undo(undo) => {
                let last_valid_block =
                    undo.last_valid_block.as_ref().map(|b| b.number).unwrap_or(0);
                let last_valid_cursor = undo.last_valid_cursor.clone();
                tracing::warn!(
                    last_valid_block,
                    cursor = %last_valid_cursor,
                    "reorg: rewinding to last valid block",
                );
                // 1) Rewind the cursor store first so a crash during the
                //    in-memory rewind leaves us with a consistent on-disk
                //    position.
                self.cursors.rewind(&last_valid_cursor, last_valid_block)?;
                // 2) Rewind in-memory price cache. For Session 2 we just
                //    clear it — Session 3 will track per-block deltas so we
                //    can restore the exact pre-reorg state.
                self.price_cache.lock().unwrap().clear();
                Ok(())
            }
        }
    }

    /// Decode the `MapModuleOutput.value` payload of a block into the
    /// TopLedger `sf.solana.dex.trades.v1.Output` proto, match each trade
    /// against our tracked pool set, compute `PoolPrice`, and broadcast.
    ///
    /// Any single-trade failure (bad pubkey, mint mismatch, numeric
    /// overflow) is logged and skipped — one bad trade must not fail the
    /// whole block and prevent cursor advancement.
    async fn handle_block(
        self: &Arc<Self>,
        block: BlockScopedData,
    ) -> Result<(), DexautoTrackerError> {
        // `BlockScopedData.output` *is* the `MapModuleOutput` for our module;
        // its `.map_output` is a `prost_types::Any` wrapping the Protobuf-
        // encoded payload bytes in its `.value`.
        let Some(map_out) = block.output.as_ref() else {
            // No output for this block (e.g. a block with zero DEX trades).
            return Ok(());
        };
        let Some(any_payload) = map_out.map_output.as_ref() else {
            return Ok(());
        };
        let bytes = &any_payload.value;
        if bytes.is_empty() {
            return Ok(());
        }

        let decoded = match Output::decode(bytes.as_slice()) {
            Ok(d) => d,
            Err(e) => {
                // Wrong `.spkg` or schema drift. Log once per block; don't
                // crash the runner — a mis-configured output module will
                // surface as "no prices" and the operator can fix it.
                tracing::warn!(
                    error = %e,
                    type_url = %any_payload.type_url,
                    bytes = bytes.len(),
                    "failed to decode MapModuleOutput as sf.solana.dex.trades.v1.Output"
                );
                return Ok(());
            }
        };

        if decoded.data.is_empty() {
            return Ok(());
        }

        let mut n_matched = 0usize;
        let mut n_broadcast = 0usize;

        // Take a short-lived clone of the tracked-pool map keyed by address
        // so we don't hold the mutex across the await point / broadcast call.
        let snapshot: HashMap<Pubkey, DexPool> =
            self.pools.lock().unwrap().clone();

        for trade in &decoded.data {
            // Fast path: parse pool address once; skip if not tracked.
            let pool_addr = match trade.pool_address.parse::<Pubkey>() {
                Ok(p) => p,
                Err(_) => continue,
            };
            let Some(tracked) = snapshot.get(&pool_addr) else { continue };
            n_matched += 1;

            let Some(price) = PoolPrice::from_trade_data(trade, tracked) else {
                tracing::trace!(
                    pool = %pool_addr,
                    base = %trade.base_amount,
                    quote = %trade.quote_amount,
                    "trade rejected by PoolPrice::from_trade_data"
                );
                continue;
            };

            // Update the per-pool latest-price cache. Overwriting unconditionally
            // gives us "last trade wins within a block"; this is what downstream
            // consumers (RPC subscribers, strategy engine) expect.
            self.price_cache
                .lock()
                .unwrap()
                .insert(pool_addr, price.clone());

            // Broadcast. `send` only errors when there are zero receivers,
            // which is normal (no one subscribed yet) — ignore.
            let _ = self.tx.send(price);
            n_broadcast += 1;
        }

        if n_broadcast > 0 {
            tracing::debug!(
                slot = block.clock.as_ref().map(|c| c.number).unwrap_or(0),
                trades_in_block = decoded.data.len(),
                matched = n_matched,
                broadcast = n_broadcast,
                "processed block"
            );
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use prost::Message;
    use prost_types::Any;
    use solana_pubkey::Pubkey;

    use super::*;
    use crate::{
        cursor_store::CursorStore,
        dex_pool::DexKind,
        pb::sf::{
            solana::dex::trades::v1::{Output as TradesOutput, TradeData},
            substreams::{
                rpc::v2::MapModuleOutput,
                v1::Clock,
            },
        },
    };

    fn mk_runner(pools: Vec<PoolConfig>) -> Arc<TokenPriceRunner> {
        let tmp = tempfile::tempdir().unwrap();
        let cursors = CursorStore::open(tmp.path().join("c.redb")).unwrap();
        // `lazy_for_tests` builds an endpoint that never actually dials — safe
        // because `handle_block` is a pure function that never issues RPCs.
        let endpoint = SubstreamsEndpoint::lazy_for_tests();
        let node = TradingTrackerNode {
            endpoint: "http://x".into(),
            api_key: None,
            package: "x.spkg".into(),
            module: "map_trades".into(),
        };
        let runner = TokenPriceRunner::new(endpoint, node, 0, cursors, pools).unwrap();
        // Keep the tmpdir alive for the lifetime of the test by leaking; the
        // test process exits right after anyway.
        std::mem::forget(tmp);
        runner
    }

    fn mk_block(trades: Vec<TradeData>) -> BlockScopedData {
        let payload_bytes = TradesOutput { data: trades }.encode_to_vec();
        BlockScopedData {
            output: Some(MapModuleOutput {
                name: "map_trades".into(),
                map_output: Some(Any {
                    type_url: "type.googleapis.com/sf.solana.dex.trades.v1.Output".into(),
                    value: payload_bytes,
                }),
                debug_info: None,
            }),
            clock: Some(Clock {
                id: "block".into(),
                number: 12345,
                timestamp: None,
            }),
            cursor: "test-cursor".into(),
            final_block_height: 0,
            debug_map_outputs: vec![],
            debug_store_outputs: vec![],
            attestation: String::new(),
            is_partial: false,
            partial_index: None,
            is_last_partial: None,
        }
    }

    fn mk_trade(pool: Pubkey, base: Pubkey, quote: Pubkey, ba: f64, qa: f64) -> TradeData {
        TradeData {
            block_date: "2024-01-01".into(),
            block_time: 1_700_000_000,
            block_slot: 12_345,
            tx_id: "sig".into(),
            tx_index: 0,
            signer: "s".into(),
            pool_address: pool.to_string(),
            base_mint: base.to_string(),
            quote_mint: quote.to_string(),
            base_vault: "v1".into(),
            quote_vault: "v2".into(),
            base_amount: ba,
            quote_amount: qa,
            is_inner_instruction: false,
            instruction_index: 0,
            instruction_type: "swap_base_in".into(),
            inner_instruxtion_index: 0,
            outer_program: crate::dex_pool::program_ids::RAYDIUM_AMM_V4.into(),
            inner_program: "".into(),
            txn_fee_lamports: 5000,
            signer_lamports_change: -5000,
            trader: "t".into(),
            outer_executing_accounts: vec![],
            trader_lamports_change: 0,
            trader_token_balance_changes: vec![],
        }
    }

    #[tokio::test]
    async fn handle_block_broadcasts_matched_trades() {
        let pool = Pubkey::new_unique();
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let runner = mk_runner(vec![PoolConfig {
            kind: DexKind::RaydiumAmm,
            address: pool,
            mint_a: a,
            mint_b: b,
            bonding_curve: None,
        }]);

        let mut rx = runner.subscribe();
        let block = mk_block(vec![mk_trade(pool, a, b, 1.0, 200.0)]);
        runner.handle_block(block).await.unwrap();

        let got = rx.try_recv().expect("expected one broadcast");
        assert_eq!(got.pool, pool);
        assert_eq!(got.price, rust_decimal::Decimal::from(200));
    }

    #[tokio::test]
    async fn handle_block_skips_untracked_pool() {
        let tracked = Pubkey::new_unique();
        let other = Pubkey::new_unique();
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let runner = mk_runner(vec![PoolConfig {
            kind: DexKind::RaydiumAmm,
            address: tracked,
            mint_a: a,
            mint_b: b,
            bonding_curve: None,
        }]);
        let mut rx = runner.subscribe();
        let block = mk_block(vec![mk_trade(other, a, b, 1.0, 1.0)]);
        runner.handle_block(block).await.unwrap();
        assert!(rx.try_recv().is_err(), "untracked pool must not broadcast");
    }

    #[tokio::test]
    async fn handle_block_survives_garbage_payload() {
        let pool = Pubkey::new_unique();
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let runner = mk_runner(vec![PoolConfig {
            kind: DexKind::RaydiumAmm,
            address: pool,
            mint_a: a,
            mint_b: b,
            bonding_curve: None,
        }]);
        let mut block = mk_block(vec![]);
        // Replace the Any payload's value bytes with garbage that will fail
        // prost decoding for `Output`.
        block
            .output
            .as_mut()
            .unwrap()
            .map_output
            .as_mut()
            .unwrap()
            .value = vec![0xff; 100];
        // Must not error — the runner swallows decode errors as warnings so
        // cursor advancement isn't blocked by a bad `.spkg`.
        runner.handle_block(block).await.unwrap();
    }
}
