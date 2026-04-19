//! `SubstreamsStream` — a `futures::Stream` wrapping the gRPC `Blocks` call,
//! with **transparent reconnection** driven by the last persisted cursor.
//!
//! Matches the closed-source
//! `<token_price_manager::substreams_stream::SubstreamsStream as futures::Stream>::poll_next`
//! behaviour:
//!
//! * yields `SubstreamsEvent::BlockData` / `Undo` items for the consumer to
//!   process (cursor is embedded in `BlockScopedData.cursor`);
//! * transparently reconnects on transient gRPC errors using exponential
//!   backoff, starting each retry from the last cursor the **consumer**
//!   persisted (read from the shared `CursorStore`, not held in-memory —
//!   this ensures exactly-once semantics even under ungraceful restarts);
//! * propagates `FatalError` messages and the sentinel "cursor not found"
//!   server error (the server returns this when our cursor is too old; the
//!   consumer should reset to `start_block_num`).

use std::{pin::Pin, time::Duration};

use async_stream::try_stream;
use futures::{Stream, StreamExt};

use crate::{
    cursor_store::CursorStore,
    error::DexautoTrackerError,
    pb::sf::substreams::rpc::v2::{response::Message, BlockScopedData, BlockUndoSignal, Request},
};

use super::substreams::SubstreamsEndpoint;

/// Items yielded by `SubstreamsStream`.
#[derive(Debug)]
pub enum SubstreamsEvent {
    /// Normal block data — parse this to extract DEX trades.
    BlockData(BlockScopedData),
    /// Chain reorg: everything after `last_valid_block` is invalid.
    Undo(BlockUndoSignal),
}

/// Boxed dynamic stream — the usual pattern for wrapping `async_stream`.
pub type SubstreamsStream =
    Pin<Box<dyn Stream<Item = Result<SubstreamsEvent, DexautoTrackerError>> + Send>>;

/// Construct the reconnecting stream.
///
/// Each time the underlying gRPC stream errors out, this helper waits
/// `backoff` (capped at `MAX_BACKOFF`), reloads the cursor from `store`, and
/// reopens a fresh stream. This mirrors the `streamingfast/substreams-sink-rust`
/// reference implementation and the behaviour observed in the closed-source
/// ELF's poll loop (it exponentially backed off and never gave up on
/// reconnection).
pub fn new(
    endpoint: SubstreamsEndpoint,
    request_template: Request,
    store: CursorStore,
) -> SubstreamsStream {
    Box::pin(try_stream! {
        let mut backoff = Duration::from_millis(500);
        const MAX_BACKOFF: Duration = Duration::from_secs(30);

        loop {
            // Always re-read the cursor from the persistent store at the top
            // of each reconnection attempt; the consumer may have advanced it
            // (or `rewind()`'d on a reorg) between attempts.
            let snapshot = store.load()?;
            let mut request = request_template.clone();
            if let Some(c) = snapshot.cursor.as_deref() {
                request.start_cursor = c.to_string();
                tracing::info!(cursor = %c, last_block = snapshot.last_block, "resuming substreams");
            } else {
                tracing::info!(start_block = request.start_block_num, "opening fresh substreams");
            }

            let mut client = endpoint.client();
            let streaming = match client.blocks(request).await {
                Ok(resp) => resp.into_inner(),
                Err(status) => {
                    tracing::warn!(%status, ?backoff, "blocks() rejected, retrying");
                    tokio::time::sleep(backoff).await;
                    backoff = (backoff * 2).min(MAX_BACKOFF);
                    continue;
                }
            };
            // Successful open resets the backoff.
            backoff = Duration::from_millis(500);

            tokio::pin!(streaming);
            while let Some(frame) = streaming.next().await {
                match frame {
                    Ok(resp) => {
                        let Some(msg) = resp.message else { continue };
                        match msg {
                            Message::BlockScopedData(b) => {
                                yield SubstreamsEvent::BlockData(b);
                            }
                            Message::BlockUndoSignal(u) => {
                                yield SubstreamsEvent::Undo(u);
                            }
                            Message::Session(s) => {
                                tracing::info!(
                                    trace_id = %s.trace_id,
                                    resolved_start = s.resolved_start_block,
                                    max_parallel = s.max_parallel_workers,
                                    "substreams session opened"
                                );
                            }
                            Message::Progress(_) => { /* noisy, skip */ }
                            Message::FatalError(e) => {
                                Err(DexautoTrackerError::Substreams(format!(
                                    "fatal from server: {} (module={})",
                                    e.reason,
                                    e.module,
                                )))?;
                            }
                            Message::DebugSnapshotData(_)
                            | Message::DebugSnapshotComplete(_) => {
                                // Dev-mode only; ignore in production.
                            }
                        }
                    }
                    Err(status) => {
                        tracing::warn!(%status, ?backoff, "stream frame error, reconnecting");
                        break;
                    }
                }
            }

            tokio::time::sleep(backoff).await;
            backoff = (backoff * 2).min(MAX_BACKOFF);
        }
    })
}
