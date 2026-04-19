use common::context::PaymentContext;
use sea_orm::{ConnectionTrait, Statement, DatabaseBackend, TransactionTrait};

/// Redis key prefix for distributed payment locks
const PAYMENT_LOCK_PREFIX: &str = "payment_lock:";
/// Lock TTL in seconds (prevents deadlock if submitter crashes)
const PAYMENT_LOCK_TTL_SECS: u64 = 60;
/// Maximum number of pending payments to process per tick
const BATCH_SIZE: u64 = 10;
/// Maximum retries before marking a payment as failed
const MAX_RETRIES: i32 = 5;

/// Background payment submitter — processes pending payments via relayer.
/// FINDING-15: Includes idempotency protection via distributed locking.
pub async fn start(ctx: PaymentContext) {
    tracing::info!("Payment submitter started");
    loop {
        if let Err(e) = process_pending(&ctx).await {
            tracing::error!("Payment submitter error: {}", e);
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
}

/// Attempt to acquire a distributed lock for a payment.
/// Uses a UUID as lock value for ownership verification on release.
/// Returns Some(lock_id) if acquired, None if already held by another instance.
async fn try_acquire_lock(ctx: &PaymentContext, payment_id: &str) -> anyhow::Result<Option<String>> {
    let mut redis = ctx.redis_conn().await?;
    let lock_key = format!("{}{}", PAYMENT_LOCK_PREFIX, payment_id);
    let lock_id = uuid::Uuid::new_v4().to_string();

    // SET NX EX — atomic set-if-not-exists with expiry
    let result: Option<String> = redis::cmd("SET")
        .arg(&lock_key)
        .arg(&lock_id)
        .arg("NX")
        .arg("EX")
        .arg(PAYMENT_LOCK_TTL_SECS)
        .query_async(&mut redis)
        .await?;

    if result.is_some() {
        Ok(Some(lock_id))
    } else {
        Ok(None)
    }
}

/// Release the distributed lock for a payment, but only if we still own it.
/// Uses a Lua script to atomically check ownership before deleting.
async fn release_lock(ctx: &PaymentContext, payment_id: &str, lock_id: &str) -> anyhow::Result<()> {
    let mut redis = ctx.redis_conn().await?;
    let lock_key = format!("{}{}", PAYMENT_LOCK_PREFIX, payment_id);

    let lua_script = r#"
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    "#;

    redis::cmd("EVAL")
        .arg(lua_script)
        .arg(1i64)
        .arg(&lock_key)
        .arg(lock_id)
        .query_async::<i64>(&mut redis)
        .await?;

    Ok(())
}

async fn process_pending(ctx: &PaymentContext) -> anyhow::Result<()> {
    let db = ctx.db();

    // BUG-2/3 fix: First, SELECT candidate payments without FOR UPDATE to identify work.
    // Then process each payment with its OWN individual DB transaction to prevent
    // the double-spend bug where a batch COMMIT failure rolls back already-submitted payments.
    let rows = db
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::MySql,
            r#"SELECT id, chain_id, calldata, signature, retry_count
               FROM submitter_transactions
               WHERE status = 'pending' AND retry_count < ?
               ORDER BY id ASC
               LIMIT ?"#,
            [MAX_RETRIES.into(), BATCH_SIZE.into()],
        ))
        .await?;

    for row in rows {
        use sea_orm::QueryResult;

        // BUG-12 fix: Parse row fields without propagating errors — skip on failure
        // so one bad row doesn't abort the entire batch.
        let payment_id: u64 = match row.try_get("", "id") {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("Failed to parse payment row 'id': {}", e);
                continue;
            }
        };
        let chain_id: u64 = match row.try_get("", "chain_id") {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("Failed to parse payment {} 'chain_id': {}", payment_id, e);
                continue;
            }
        };
        let calldata: String = match row.try_get("", "calldata") {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("Failed to parse payment {} 'calldata': {}", payment_id, e);
                continue;
            }
        };
        let signature: String = match row.try_get("", "signature") {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("Failed to parse payment {} 'signature': {}", payment_id, e);
                continue;
            }
        };
        let retry_count: i32 = match row.try_get("", "retry_count") {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("Failed to parse payment {} 'retry_count': {}", payment_id, e);
                continue;
            }
        };
        let id_str = payment_id.to_string();

        // Acquire Redis distributed lock (with UUID ownership)
        // BUG-12 fix: handle lock acquisition errors per-payment
        let lock_id = match try_acquire_lock(ctx, &id_str).await {
            Ok(Some(id)) => id,
            Ok(None) => {
                tracing::debug!("Payment {} already locked by another instance, skipping", payment_id);
                continue;
            }
            Err(e) => {
                tracing::error!("Failed to acquire lock for payment {}: {}", payment_id, e);
                continue;
            }
        };

        // BUG-2/3 fix: Use a per-payment DB transaction.
        // Step 1: Mark as 'submitting' (committed) BEFORE calling relayer, so if we crash
        //         after relayer submission, the payment won't be re-submitted.
        // BUG-12 fix: handle transaction begin errors per-payment
        let pre_txn = match db.begin().await {
            Ok(txn) => txn,
            Err(e) => {
                tracing::error!("Failed to begin pre-txn for payment {}: {}", payment_id, e);
                release_lock(ctx, &id_str, &lock_id).await.ok();
                continue;
            }
        };
        let update_result = pre_txn.execute(Statement::from_sql_and_values(
            DatabaseBackend::MySql,
            "UPDATE submitter_transactions SET status = 'submitting' WHERE id = ? AND status = 'pending'",
            [payment_id.into()],
        )).await;

        match update_result {
            Ok(r) if r.rows_affected() == 0 => {
                // Another instance already picked this up — skip
                let _ = pre_txn.commit().await;
                release_lock(ctx, &id_str, &lock_id).await.ok();
                continue;
            }
            Ok(_) => {
                pre_txn.commit().await?;
            }
            Err(e) => {
                tracing::error!("Failed to mark payment {} as submitting: {}", payment_id, e);
                let _ = pre_txn.rollback().await;
                release_lock(ctx, &id_str, &lock_id).await.ok();
                continue;
            }
        }

        // Step 2: Submit via relayer (irreversible)
        let submit_result = submit_to_relayer(ctx, chain_id, &calldata, &signature).await;

        // Step 3: Update DB status based on result — each in its own committed transaction
        // BUG-12 fix: handle transaction begin errors per-payment
        let post_txn = match db.begin().await {
            Ok(txn) => txn,
            Err(e) => {
                tracing::error!("Failed to begin post-txn for payment {}: {}", payment_id, e);
                release_lock(ctx, &id_str, &lock_id).await.ok();
                continue;
            }
        };
        match submit_result {
            Ok(tx_hash) => {
                tracing::info!("Payment {} submitted: tx_hash={}", payment_id, tx_hash);
                if let Err(e) = post_txn.execute(Statement::from_sql_and_values(
                    DatabaseBackend::MySql,
                    "UPDATE submitter_transactions SET status = 'submitted', tx_hash = ? WHERE id = ?",
                    [tx_hash.into(), payment_id.into()],
                )).await {
                    tracing::error!("Failed to update payment {} to submitted: {}", payment_id, e);
                    // Payment was already sent — it stays as 'submitting' and will need manual resolution
                    let _ = post_txn.rollback().await;
                    release_lock(ctx, &id_str, &lock_id).await.ok();
                    continue;
                }
            }
            Err(e) => {
                tracing::error!("Failed to submit payment {}: {}", payment_id, e);
                // Increment retry count; mark as failed if max retries exceeded
                let new_status = if retry_count + 1 >= MAX_RETRIES { "failed" } else { "pending" };
                if let Err(e) = post_txn.execute(Statement::from_sql_and_values(
                    DatabaseBackend::MySql,
                    "UPDATE submitter_transactions SET status = ?, retry_count = retry_count + 1 WHERE id = ?",
                    [new_status.into(), payment_id.into()],
                )).await {
                    tracing::error!("Failed to update payment {} retry: {}", payment_id, e);
                    let _ = post_txn.rollback().await;
                    release_lock(ctx, &id_str, &lock_id).await.ok();
                    continue;
                }
            }
        }

        // BUG-3 fix: Commit the DB transaction BEFORE releasing the Redis lock.
        // This ensures no other instance can pick up the payment while our DB update
        // is still uncommitted, preventing the race condition window.
        // BUG-12 fix: handle commit errors per-payment instead of propagating
        if let Err(e) = post_txn.commit().await {
            tracing::error!("Failed to commit post-txn for payment {}: {}", payment_id, e);
            release_lock(ctx, &id_str, &lock_id).await.ok();
            continue;
        }

        // Only release the lock AFTER the DB commit succeeds
        release_lock(ctx, &id_str, &lock_id).await.ok();
    }

    Ok(())
}

/// Submit a payment transaction via the relayer client.
async fn submit_to_relayer(
    ctx: &PaymentContext,
    chain_id: u64,
    calldata: &str,
    signature: &str,
) -> anyhow::Result<String> {
    let relayer = crate::relayer_client::RelayerClient::new(
        &ctx.config.relayer_url,
        &ctx.config.relayer_api_key,
        &ctx.config.relayer_private_key,
    );
    relayer.submit_transaction(chain_id, calldata, signature).await
}
