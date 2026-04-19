use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;

use super::pending_transaction::{PendingTransaction, OrderKind};
use super::submitter::{TxSubmitter, SignalStrength};

/// Classify a submission error to decide retry policy. Matches are deliberately
/// fuzzy because error messages flow up from multiple layers (Jito, RPC, DEX).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ErrorKind {
    /// Slippage limit exceeded at execution time — price moved against us.
    SlippageExceeded,
    /// Jito rejected our bundle because tip was below the landed floor.
    TipTooLow,
    /// Blockhash expired before tx landed.
    BlockhashExpired,
    /// Everything else — RPC errors, network timeouts, etc.
    Other,
}

fn classify_error(msg: &str) -> ErrorKind {
    let m = msg.to_lowercase();
    if m.contains("slippage") || m.contains("minimum amount") || m.contains("slippagetoleranceexceeded") {
        return ErrorKind::SlippageExceeded;
    }
    if m.contains("tip") && (m.contains("low") || m.contains("insufficient")) {
        return ErrorKind::TipTooLow;
    }
    if m.contains("blockhash") && (m.contains("expired") || m.contains("not found")) {
        return ErrorKind::BlockhashExpired;
    }
    ErrorKind::Other
}

/// Retry decision for a given (kind, error, attempt).
struct RetryDecision {
    retry: bool,
    /// Multiplier applied to the previous tip (1.0 = no change).
    tip_multiplier: f64,
    /// Sleep before retry. Shorter than the old 5s baseline — meme coin prices
    /// move in seconds so long sleeps just push the trade further out of spec.
    sleep_ms: u64,
}

fn retry_policy(kind: OrderKind, err: ErrorKind, attempt: u32) -> RetryDecision {
    use OrderKind::*;
    use ErrorKind::*;

    // Universal: Slippage on BUY never retries (price already moved).
    if kind == Buy && err == SlippageExceeded {
        return RetryDecision { retry: false, tip_multiplier: 1.0, sleep_ms: 0 };
    }
    // Sells must eventually exit. Retry up to 3× with escalating tips.
    if kind == Sell {
        return RetryDecision {
            retry: attempt < 3,
            tip_multiplier: match attempt { 1 => 1.5, 2 => 3.0, _ => 5.0 },
            sleep_ms: 300, // ~1 slot
        };
    }
    // Buy-side specific recoverable errors:
    match err {
        TipTooLow => RetryDecision {
            retry: attempt <= 1,
            tip_multiplier: 2.0,
            sleep_ms: 100,
        },
        BlockhashExpired => RetryDecision {
            retry: attempt <= 1,
            tip_multiplier: 1.0, // same tip, new blockhash
            sleep_ms: 100,
        },
        // Generic errors on buy: one cautious retry only
        Other => RetryDecision {
            retry: attempt <= 1,
            tip_multiplier: 1.0,
            sleep_ms: 500,
        },
        SlippageExceeded => RetryDecision { retry: false, tip_multiplier: 1.0, sleep_ms: 0 },
    }
}

/// Callback trait for handling permanently failed transactions (dead-letter).
/// Implementations can persist to DB, push to a queue, send alerts, etc.
pub trait DeadLetterHandler: Send + Sync + 'static {
    fn handle_dead_letter(
        &self,
        pending: &PendingTransaction,
        last_error: &str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>>;
}

/// Default dead-letter handler that only logs (for backward compatibility).
pub struct LogOnlyDeadLetterHandler;

impl DeadLetterHandler for LogOnlyDeadLetterHandler {
    fn handle_dead_letter(
        &self,
        pending: &PendingTransaction,
        last_error: &str,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>> {
        let order_id = pending.order_id.clone();
        let retries = pending.retry_count;
        let error_msg = last_error.to_string();
        Box::pin(async move {
            tracing::error!(
                order_id = %order_id,
                retries = retries,
                error = %error_msg,
                "Dead-letter: transaction permanently failed and has been discarded"
            );
        })
    }
}

/// Background runner that processes pending transactions from a channel.
///
/// Fixed: on transient failure the transaction is now actually re-submitted
/// (previously the code slept but never looped back to re-submit).
/// Added: dead-letter handling for transactions that exhaust all retries.
pub async fn run_submitter(
    submitter: Arc<TxSubmitter>,
    rx: mpsc::Receiver<PendingTransaction>,
) -> Result<()> {
    run_submitter_with_dead_letter(submitter, rx, Arc::new(LogOnlyDeadLetterHandler)).await
}

/// Like `run_submitter` but accepts a custom dead-letter handler for permanently
/// failed transactions (e.g. update DB status to Failed, push to alerting queue).
pub async fn run_submitter_with_dead_letter(
    submitter: Arc<TxSubmitter>,
    mut rx: mpsc::Receiver<PendingTransaction>,
    dead_letter: Arc<dyn DeadLetterHandler>,
) -> Result<()> {
    tracing::info!("TX submitter runner started");

    while let Some(mut pending) = rx.recv().await {
        let signal = SignalStrength::from_consensus_votes(pending.consensus_votes);
        tracing::info!(
            "Processing tx: order_id={}, kind={:?}, tip={} lamports, signal={:?}",
            pending.order_id, pending.order_kind, pending.bribery_amount, signal,
        );

        let mut last_error = String::new();
        let mut attempt: u32 = 0;

        // Retry loop: attempt submission; on failure, classify the error and
        // apply the kind-aware retry policy (tip escalation, shorter sleeps).
        loop {
            match submitter.submit_full(
                &pending.tx_bytes,
                pending.is_anti_mev,
                pending.bribery_amount,
                signal,
            ).await {
                Ok(sig) => {
                    tracing::info!("TX submitted: {} sig={}", pending.order_id, sig);
                    last_error.clear();
                    break; // success — move to next job
                }
                Err(e) => {
                    attempt += 1;
                    pending.retry_count = attempt;
                    last_error = e.to_string();
                    let err_kind = classify_error(&last_error);
                    let decision = retry_policy(pending.order_kind, err_kind, attempt);

                    if !decision.retry || !pending.should_retry() {
                        tracing::error!(
                            "TX permanently failed: {} kind={:?} err_kind={:?} attempts={} err={}",
                            pending.order_id, pending.order_kind, err_kind, attempt, e,
                        );
                        break;
                    }

                    // Escalate tip if the policy requires it (TipTooLow / sell retries).
                    if decision.tip_multiplier > 1.0 {
                        let new_tip = (pending.bribery_amount as f64 * decision.tip_multiplier) as u64;
                        // Keep a reasonable ceiling — don't burn the wallet on one stuck tx.
                        let capped = new_tip.min(50_000_000); // 0.05 SOL absolute max
                        pending.bribery_amount = capped.max(pending.bribery_amount);
                    }

                    tracing::warn!(
                        "TX failed, will retry: {} kind={:?} err_kind={:?} attempt={}/{} \
                         new_tip={} lamports sleep={}ms err={}",
                        pending.order_id, pending.order_kind, err_kind, attempt,
                        pending.max_retries, pending.bribery_amount, decision.sleep_ms, e,
                    );
                    tokio::time::sleep(std::time::Duration::from_millis(decision.sleep_ms)).await;
                    // loop continues → re-submit with (possibly) escalated tip
                }
            }
        }

        // Dead-letter handling for permanently failed transactions
        if !last_error.is_empty() {
            dead_letter.handle_dead_letter(&pending, &last_error).await;
        }
    }

    Ok(())
}
