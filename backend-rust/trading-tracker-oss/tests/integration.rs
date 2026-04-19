//! End-to-end integration tests for `TokenPriceRunner`.
//!
//! Unlike the module-level unit tests (which exercise only pure functions
//! like `PoolPrice::from_trade_data`), these tests drive a full runner
//! through a scripted sequence of `SubstreamsEvent`s — covering the
//! production-critical invariants:
//!
//!   1. **Exactly-once cursor persistence** — cursor advances on-disk only
//!      after `handle_block` succeeds, so a crash mid-block replays that
//!      block on restart.
//!   2. **Reorg rewind** — `BlockUndoSignal` rewinds the on-disk cursor
//!      *and* clears the in-memory price cache atomically.
//!   3. **Crash-recovery** — a fresh runner opened against the same db
//!      resumes from the last persisted cursor.
//!   4. **Fan-out broadcast** — every matched trade reaches every
//!      subscriber (including slow ones, up to the channel capacity).
//!
//! We deliberately **do not** spin up a mock gRPC server here: the
//! `SubstreamsStream` layer is thin reconnection glue, while the actual
//! consumer semantics live in `deal_msg` / `handle_block` / `CursorStore`.
//! Driving `deal_msg` directly lets us script adversarial sequences
//! (block, block, undo, block, crash, restart) without any sockets.

use std::{sync::Arc, time::Duration};

use prost::Message;
use prost_types::Any;
use solana_pubkey::Pubkey;
use tempfile::TempDir;

use trading_tracker_oss::{
    config::{PoolConfig, TradingTrackerNode},
    cursor_store::CursorStore,
    dex_pool::DexKind,
    pb::sf::{
        solana::dex::trades::v1::{Output as TradesOutput, TradeData},
        substreams::{
            rpc::v2::{BlockScopedData, BlockUndoSignal, MapModuleOutput},
            v1::{BlockRef, Clock},
        },
    },
    token_price_manager::{
        runner::TokenPriceRunner,
        substreams::SubstreamsEndpoint,
        substreams_stream::SubstreamsEvent,
    },
};

// ---------- test fixtures ----------

struct Fixture {
    runner: Arc<TokenPriceRunner>,
    cursors: CursorStore,
    _tmp: TempDir,
    pool: Pubkey,
    mint_a: Pubkey,
    mint_b: Pubkey,
}

impl Fixture {
    fn new() -> Self {
        Self::new_at(TempDir::new().unwrap())
    }

    /// Open a fresh runner backed by a brand-new cursor db under `tmp`.
    /// Use together with `reopen()` to simulate a process restart.
    fn new_at(tmp: TempDir) -> Self {
        let db_path = tmp.path().join("c.redb");
        let cursors = CursorStore::open(&db_path).unwrap();
        let pool = Pubkey::new_unique();
        let mint_a = Pubkey::new_unique();
        let mint_b = Pubkey::new_unique();
        let runner = TokenPriceRunner::new(
            SubstreamsEndpoint::lazy_for_tests(),
            TradingTrackerNode {
                endpoint: "http://x".into(),
                api_key: None,
                package: "x.spkg".into(),
                module: "map_trades".into(),
            },
            0,
            cursors.clone(),
            vec![PoolConfig {
                kind: DexKind::RaydiumAmm,
                address: pool,
                mint_a,
                mint_b,
                bonding_curve: None,
            }],
        )
        .unwrap();
        Self { runner, cursors, _tmp: tmp, pool, mint_a, mint_b }
    }

    /// Consume the tempdir + cursor store, return the tempdir so a follow-up
    /// `Fixture::new_at` can recreate a runner backed by the same db — this
    /// models a process restart against a persisted cursor.
    fn into_tmp(self) -> TempDir {
        self._tmp
    }

    fn block_with_trades(cursor: &str, slot: u64, trades: Vec<TradeData>) -> BlockScopedData {
        let payload = TradesOutput { data: trades }.encode_to_vec();
        BlockScopedData {
            output: Some(MapModuleOutput {
                name: "map_trades".into(),
                map_output: Some(Any {
                    type_url: "type.googleapis.com/sf.solana.dex.trades.v1.Output".into(),
                    value: payload,
                }),
                debug_info: None,
            }),
            clock: Some(Clock {
                id: format!("block-{slot}"),
                number: slot,
                timestamp: None,
            }),
            cursor: cursor.into(),
            final_block_height: slot.saturating_sub(32),
            debug_map_outputs: vec![],
            debug_store_outputs: vec![],
            attestation: String::new(),
            is_partial: false,
            partial_index: None,
            is_last_partial: None,
        }
    }

    fn undo(cursor: &str, last_valid: u64) -> BlockUndoSignal {
        BlockUndoSignal {
            last_valid_block: Some(BlockRef {
                id: format!("block-{last_valid}"),
                number: last_valid,
            }),
            last_valid_cursor: cursor.into(),
        }
    }

    fn trade(&self, slot: u64, base_amount: f64, quote_amount: f64) -> TradeData {
        TradeData {
            block_date: "2024-01-01".into(),
            block_time: 1_700_000_000,
            block_slot: slot,
            tx_id: "sig".into(),
            tx_index: 0,
            signer: "s".into(),
            pool_address: self.pool.to_string(),
            base_mint: self.mint_a.to_string(),
            quote_mint: self.mint_b.to_string(),
            base_vault: "v1".into(),
            quote_vault: "v2".into(),
            base_amount,
            quote_amount,
            is_inner_instruction: false,
            instruction_index: 0,
            instruction_type: "swap_base_in".into(),
            inner_instruxtion_index: 0,
            outer_program: trading_tracker_oss::dex_pool::program_ids::RAYDIUM_AMM_V4.into(),
            inner_program: "".into(),
            txn_fee_lamports: 5000,
            signer_lamports_change: -5000,
            trader: "t".into(),
            outer_executing_accounts: vec![],
            trader_lamports_change: 0,
            trader_token_balance_changes: vec![],
        }
    }
}

// ---------- tests ----------

#[tokio::test]
async fn cursor_advances_monotonically_across_blocks() {
    let fx = Fixture::new();

    for (slot, cursor) in [(100, "c1"), (101, "c2"), (102, "c3")] {
        let block = Fixture::block_with_trades(cursor, slot, vec![fx.trade(slot, 1.0, slot as f64)]);
        fx.runner.deal_msg(SubstreamsEvent::BlockData(block)).await.unwrap();
    }

    let snap = fx.cursors.load().unwrap();
    assert_eq!(snap.cursor.as_deref(), Some("c3"));
    assert_eq!(snap.last_block, 102);
    // final_block_height = slot - 32 at slot=102 → 70.
    assert_eq!(snap.final_block_height, 70);
}

#[tokio::test]
async fn crash_recovery_resumes_from_last_persisted_cursor() {
    // 1st process lifecycle: ingest two blocks, then "crash" (drop the fixture).
    let tmp = {
        let fx = Fixture::new();
        for (slot, cursor) in [(200, "c-a"), (201, "c-b")] {
            let block = Fixture::block_with_trades(cursor, slot, vec![fx.trade(slot, 1.0, 50.0)]);
            fx.runner.deal_msg(SubstreamsEvent::BlockData(block)).await.unwrap();
        }
        fx.into_tmp()
    };

    // 2nd process lifecycle: reopen, cursor must be recoverable.
    let fx2 = Fixture::new_at(tmp);
    let snap = fx2.cursors.load().unwrap();
    assert_eq!(snap.cursor.as_deref(), Some("c-b"));
    assert_eq!(snap.last_block, 201);
}

#[tokio::test]
async fn reorg_rewinds_cursor_and_clears_price_cache() {
    let fx = Fixture::new();

    // Advance past a few blocks so the price cache is populated.
    for (slot, cursor, price) in [(300_u64, "c-pre-1", 10.0), (301, "c-pre-2", 20.0)] {
        let block = Fixture::block_with_trades(cursor, slot, vec![fx.trade(slot, 1.0, price)]);
        fx.runner.deal_msg(SubstreamsEvent::BlockData(block)).await.unwrap();
    }
    assert!(fx.runner.latest_price(&fx.pool).is_some());

    // Now a reorg arrives, rewinding to slot 299.
    fx.runner
        .deal_msg(SubstreamsEvent::Undo(Fixture::undo("c-pre-0", 299)))
        .await
        .unwrap();

    let snap = fx.cursors.load().unwrap();
    assert_eq!(snap.cursor.as_deref(), Some("c-pre-0"));
    assert_eq!(snap.last_block, 299);
    // Session-3 reorg handler clears the cache wholesale; a future session
    // may replay the canonical side of the fork to repopulate.
    assert!(
        fx.runner.latest_price(&fx.pool).is_none(),
        "price cache must be empty after undo"
    );
}

#[tokio::test]
async fn broadcast_reaches_subscribers_and_updates_cache() {
    let fx = Fixture::new();
    let mut rx1 = fx.runner.subscribe();
    let mut rx2 = fx.runner.subscribe();

    let block = Fixture::block_with_trades(
        "c-broadcast",
        400,
        vec![fx.trade(400, 1.0, 42.5)],
    );
    fx.runner.deal_msg(SubstreamsEvent::BlockData(block)).await.unwrap();

    // Cache updated.
    let cached = fx.runner.latest_price(&fx.pool).expect("price cached");
    assert_eq!(cached.pool, fx.pool);
    assert_eq!(cached.price.to_string(), "42.5");

    // Both subscribers receive the same update (fan-out).
    let p1 = tokio::time::timeout(Duration::from_millis(100), rx1.recv())
        .await
        .expect("rx1 timed out")
        .expect("rx1 channel closed");
    let p2 = tokio::time::timeout(Duration::from_millis(100), rx2.recv())
        .await
        .expect("rx2 timed out")
        .expect("rx2 channel closed");
    assert_eq!(p1.price, p2.price);
    assert_eq!(p1.slot, 400);
}

#[tokio::test]
async fn empty_block_still_persists_cursor() {
    // Substreams emits BlockScopedData even for blocks with zero DEX trades;
    // the cursor must still advance so we don't re-process empties forever.
    let fx = Fixture::new();

    let empty_block = Fixture::block_with_trades("c-empty", 500, vec![]);
    fx.runner.deal_msg(SubstreamsEvent::BlockData(empty_block)).await.unwrap();

    let snap = fx.cursors.load().unwrap();
    assert_eq!(snap.cursor.as_deref(), Some("c-empty"));
    assert_eq!(snap.last_block, 500);
}
