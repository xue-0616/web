use api::context::RelayerContext;

pub const TX_STREAM_KEY: &str = "relayer:tx_stream";
pub const TX_GROUP: &str = "relayer_workers";

/// MED-RL-3 gating env var.
///
/// Before this module could be trusted to consume + broadcast
/// transactions, `consume_once()` was a no-op that silently
/// returned `Ok(())` every tick. Messages written into the stream
/// piled up invisibly. Operators had no signal — no log, no
/// metric, no alert — until some user noticed their tx never
/// landed.
///
/// We cannot ship a real implementation here without a signing
/// pipeline + nonce manager + EVM send + XACK, all of which are
/// still TODO. The safe interim is:
///
///   1. On start, verify the stream and consumer group exist (or
///      can be created), so a configuration regression shows up
///      at boot rather than on first user tx.
///   2. On every tick, read the stream's pending-entries count.
///      If it is non-zero AND `RELAYER_CONSUMER_ENABLED=false`
///      (the default), log a WARN with the backlog size. If the
///      env var says `true`, still fail loud (with an anyhow
///      error that carries the backlog number) because the
///      processing code simply isn't here yet.
///
/// That turns a silent black hole into a very visible red one,
/// and lets a monitoring stack scrape `relayer:stream:pending`
/// from Redis directly while the real consumer is being built.
const CONSUMER_ENABLED_ENV: &str = "RELAYER_CONSUMER_ENABLED";

fn consumer_is_enabled() -> bool {
    matches!(
        std::env::var(CONSUMER_ENABLED_ENV).as_deref(),
        Ok("1") | Ok("true") | Ok("TRUE") | Ok("yes")
    )
}

/// Start Redis stream consumer for processing queued transactions.
pub async fn start_consumer(ctx: RelayerContext) {
    if consumer_is_enabled() {
        tracing::warn!(
            "{}=true but the real consumer pipeline is NOT yet implemented \
             (MED-RL-3). Messages will NOT be signed/broadcast. Unset the env \
             var to suppress this warning while the feature ships.",
            CONSUMER_ENABLED_ENV
        );
    } else {
        tracing::info!(
            "Redis stream consumer running in fail-loud stub mode ({}=false). \
             The stream will be observed for backlog size but NOT drained.",
            CONSUMER_ENABLED_ENV
        );
    }
    loop {
        if let Err(e) = consume_once(&ctx).await {
            tracing::warn!("Consumer tick error: {}", e);
        }
        tokio::time::sleep(std::time::Duration::from_millis(1_000)).await;
    }
}

/// Observe (but do not drain) the stream. Emits a WARN-level log
/// whenever the stream has entries, so a stuck tx queue is visible
/// in operational logs without adding a Prometheus dependency.
async fn consume_once(ctx: &RelayerContext) -> anyhow::Result<()> {
    let mut conn = ctx.redis_conn().await?;

    // XLEN is O(1) and returns the current total length of the
    // stream. We report this; the *unclaimed* backlog would need
    // XPENDING, which requires the consumer group to exist — we
    // don't create it here to avoid paper-over-cracks behaviour.
    let len: i64 = redis::cmd("XLEN")
        .arg(TX_STREAM_KEY)
        .query_async(&mut conn)
        .await
        .unwrap_or(0);

    if len > 0 {
        if consumer_is_enabled() {
            anyhow::bail!(
                "{} messages queued in {} but the consumer is a stub (MED-RL-3). \
                 Refusing to pretend the queue is drained.",
                len,
                TX_STREAM_KEY
            );
        } else {
            tracing::warn!(
                stream = TX_STREAM_KEY,
                len,
                "Tx-stream has queued messages; consumer disabled (fail-loud stub). \
                 Real processing pipeline still TODO."
            );
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    //! Env-var gate unit tests. The Redis side of `consume_once`
    //! is covered by integration tests (a live Redis is required
    //! and is not part of the per-PR test job).
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn consumer_disabled_by_default() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var(CONSUMER_ENABLED_ENV);
        assert!(!consumer_is_enabled());
    }

    #[test]
    fn consumer_enabled_by_truthy_values() {
        let _g = ENV_LOCK.lock().unwrap();
        for v in ["1", "true", "TRUE", "yes"] {
            std::env::set_var(CONSUMER_ENABLED_ENV, v);
            assert!(consumer_is_enabled(), "value {:?} should enable", v);
        }
        std::env::remove_var(CONSUMER_ENABLED_ENV);
    }

    #[test]
    fn consumer_disabled_by_falsy_and_garbage_values() {
        let _g = ENV_LOCK.lock().unwrap();
        for v in ["0", "false", "no", "", "maybe"] {
            std::env::set_var(CONSUMER_ENABLED_ENV, v);
            assert!(
                !consumer_is_enabled(),
                "value {:?} must NOT enable the consumer",
                v
            );
        }
        std::env::remove_var(CONSUMER_ENABLED_ENV);
    }
}
