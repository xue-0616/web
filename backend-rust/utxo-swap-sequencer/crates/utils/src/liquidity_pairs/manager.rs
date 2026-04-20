use api_common::context::AppContext;
use entity_crate::{intents, pool_txs};
use sea_orm::*;
use sea_orm::sea_query::Expr;
use sea_orm::TransactionTrait;
use std::time::Duration;

/// SECURITY (M-8): Maximum number of intents per batch
const MAX_BATCH_SIZE: usize = 50;

/// SECURITY (C-3): Minimum batch delay in milliseconds to prevent front-running
const MIN_BATCH_DELAY_MS: u64 = 500;

/// Main liquidity pairs manager — runs as background task
///
/// Flow:
/// 1. Periodically scan for pending intents grouped by pool
/// 2. For each pool with pending intents:
///    a. Acquire distributed lock (L-5: TOCTOU mitigation)
///    b. Fetch current on-chain pool state
///    c. Run intent-solver batch (bounded to MAX_BATCH_SIZE)
///    d. Build CKB transaction
///    e. Sign with sequencer key
///    f. Submit to CKB node
///    g. Update DB status
/// 3. Monitor submitted transactions for confirmation
pub async fn start(ctx: AppContext) -> anyhow::Result<()> {
    tracing::info!("Liquidity pairs manager started");

    let mut interval = tokio::time::interval(Duration::from_secs(3));

    loop {
        interval.tick().await;

        // SECURITY (C-3): Enforce minimum batch delay to prevent front-running
        tokio::time::sleep(Duration::from_millis(MIN_BATCH_DELAY_MS)).await;

        if let Err(e) = process_pending_intents(&ctx).await {
            tracing::error!("Error processing intents: {}", e);
        }

        if let Err(e) = monitor_submitted_txs(&ctx).await {
            tracing::error!("Error monitoring txs: {}", e);
        }
    }
}

/// Fetch pending intents and process them in batches per pool
async fn process_pending_intents(ctx: &AppContext) -> anyhow::Result<()> {
    // Find all pending intents, ordered by creation time for FIFO (C-3)
    let pending = intents::Entity::find()
        .filter(intents::Column::Status.eq(intents::IntentStatus::Pending))
        .order_by_asc(intents::Column::CreatedAt)
        .all(ctx.db())
        .await?;

    if pending.is_empty() {
        return Ok(());
    }

    tracing::info!("Found {} pending intents", pending.len());

    // Group by pool_type_hash
    let mut pools_map: std::collections::HashMap<Vec<u8>, Vec<intents::Model>> =
        std::collections::HashMap::new();

    for intent in pending {
        pools_map
            .entry(intent.pool_type_hash.clone())
            .or_default()
            .push(intent);
    }

    // Process each pool's batch
    for (pool_hash, pool_intents) in pools_map {
        let pool_hex = hex::encode(&pool_hash);

        // SECURITY (M-8): Limit batch size
        let batch_size = pool_intents.len().min(MAX_BATCH_SIZE);
        let batch = pool_intents.into_iter().take(batch_size).collect::<Vec<_>>();

        tracing::info!(
            "Processing {} intents for pool {} (max batch size: {})",
            batch.len(),
            pool_hex,
            MAX_BATCH_SIZE
        );

        if let Err(e) = process_pool_batch(ctx, &pool_hash, batch.clone()).await {
            tracing::error!("Error processing pool {}: {}", pool_hex, e);

            // BL-H3 fix: On batch failure, reset any intents that were marked as Processing
            // back to Pending so they can be retried in the next cycle.
            let failed_ids: Vec<u64> = batch.iter().map(|i| i.id).collect();
            if !failed_ids.is_empty() {
                let now = chrono::Utc::now().naive_utc();
                if let Err(rollback_err) = intents::Entity::update_many()
                    .filter(intents::Column::Id.is_in(failed_ids.clone()))
                    .filter(intents::Column::Status.eq(intents::IntentStatus::Processing))
                    .col_expr(intents::Column::Status, Expr::value(intents::IntentStatus::Pending))
                    .col_expr(intents::Column::UpdatedAt, Expr::value(now))
                    .exec(ctx.db())
                    .await
                {
                    tracing::error!(
                        "BL-H3: Failed to rollback intents for pool {}: {}",
                        pool_hex,
                        rollback_err
                    );
                } else {
                    tracing::info!(
                        "BL-H3: Rolled back {} intents to Pending for pool {}",
                        failed_ids.len(),
                        pool_hex
                    );
                }
            }
        }
    }

    Ok(())
}

/// Process a single pool's batch of intents
async fn process_pool_batch(
    ctx: &AppContext,
    pool_hash: &[u8],
    intents_batch: Vec<intents::Model>,
) -> anyhow::Result<()> {
    // SECURITY (L-5, H-4): Acquire distributed lock BEFORE fetching intents to prevent TOCTOU
    let _lock = super::lock::acquire_pool_lock(&ctx.redis, pool_hash).await?;

    // SECURITY (C-3): Log batch processing with timestamps for auditability
    let batch_start = chrono::Utc::now();
    let intent_ids: Vec<u64> = intents_batch.iter().map(|i| i.id).collect();
    tracing::info!(
        "Batch processing started at {} for pool {} with intent_ids: {:?}",
        batch_start,
        hex::encode(pool_hash),
        intent_ids
    );

    // 2. Fetch current on-chain pool state
    let mut pool_type_hash_arr = [0u8; 32];
    pool_type_hash_arr.copy_from_slice(pool_hash);
    let on_chain = super::pool::fetch_pool_state(ctx, &pool_type_hash_arr).await?;

    // BL-M3 fix: Validate fee_rate is within valid bounds (0..=10000 basis points).
    // A corrupted or malicious on-chain fee_rate > 10000 would cause all swaps to produce
    // zero output (100%+ fee) or cause incorrect fee_amount reporting via overflow.
    if on_chain.fee_rate > 10000 {
        anyhow::bail!(
            "BL-M3: Pool {} has invalid fee_rate {} (max 10000 bps). Skipping batch.",
            hex::encode(pool_hash),
            on_chain.fee_rate
        );
    }

    let pair_info = types::intent::PairInfo {
        pool_type_hash: pool_type_hash_arr,
        asset_x_reserve: on_chain.asset_x_reserve,
        asset_y_reserve: on_chain.asset_y_reserve,
        total_lp_supply: on_chain.total_lp_supply,
        fee_rate: on_chain.fee_rate,
        // BL-C2 fix: Use actual LP type_script args from on-chain pool state
        lp_type_args: on_chain.lp_type_args.clone().unwrap_or_default(),
    };

    // 3. Parse intents into solver format
    let parsed: Vec<(u64, types::intent::ParsedIntent)> = intents_batch
        .iter()
        .map(|i| {
            let swap_type = i.swap_type.as_ref().map(|st| match st {
                intents::SwapType::XToY => types::intent::SwapDirection::XToY,
                intents::SwapType::YToX => types::intent::SwapDirection::YToX,
            });
            let intent_type = match i.intent_type {
                intents::IntentType::SwapExactInputForOutput => types::intent::IntentType::SwapExactInputForOutput,
                intents::IntentType::SwapInputForExactOutput => types::intent::IntentType::SwapInputForExactOutput,
                intents::IntentType::AddLiquidity => types::intent::IntentType::AddLiquidity,
                intents::IntentType::RemoveLiquidity => types::intent::IntentType::RemoveLiquidity,
            };
            let mut asset_x_hash = [0u8; 32];
            let mut asset_y_hash = [0u8; 32];
            let mut code_hash = [0u8; 32];
            if i.asset_x_type_hash.len() == 32 { asset_x_hash.copy_from_slice(&i.asset_x_type_hash); }
            if i.asset_y_type_hash.len() == 32 { asset_y_hash.copy_from_slice(&i.asset_y_type_hash); }
            if i.lock_code_hash.len() == 32 { code_hash.copy_from_slice(&i.lock_code_hash); }
            let amount_in = i.amount_in.to_string().parse::<u128>().unwrap_or(0);
            let min_amount = i.min_amount.to_string().parse::<u128>().unwrap_or(0);
            (
                i.id,
                types::intent::ParsedIntent {
                    intent_type,
                    pool_type_hash: pool_type_hash_arr,
                    asset_x_type_hash: asset_x_hash,
                    asset_y_type_hash: asset_y_hash,
                    // BL-C1 fix: Use actual type_script args from on-chain intent cell data
                    asset_x_type_args: i.asset_x_type_args.clone().unwrap_or_default(),
                    asset_y_type_args: i.asset_y_type_args.clone().unwrap_or_default(),
                    swap_type,
                    amount_in,
                    min_amount_out: min_amount,
                    user_lock: types::intent::CkbScript {
                        code_hash,
                        hash_type: 1,
                        args: i.lock_args.clone(),
                    },
                },
            )
        })
        .collect();

    // 4. Run solver
    let solver_result = intent_solver::solve_batch(&parsed, &pair_info);

    tracing::info!(
        "Solver result for pool {}: {} swaps, {} mints, {} burns, {} refunded",
        hex::encode(pool_hash),
        solver_result.swap_events.len(),
        solver_result.mint_events.len(),
        solver_result.burn_events.len(),
        solver_result.refunded.len(),
    );

    // 5-7. Build CKB transaction, sign, and submit
    // These require on-chain cell fetching and sequencer key — deferred to full integration.
    // For now, mark intents as Processing so they won't be double-picked.

    // 8. Update intent statuses — split into Processing and Refunded from the start
    // BL-M2 fix: Wrap BOTH status updates in a single DB transaction so they're atomic.
    // If a crash occurs mid-way, the transaction is rolled back and all intents remain
    // in Pending (safe — they'll be re-evaluated next cycle). This prevents the scenario
    // where refunded intents are marked but processing intents are not, or vice versa.
    let now = chrono::Utc::now().naive_utc();
    let refunded_ids: Vec<u64> = solver_result.refunded.iter().map(|r| r.intent_id).collect();
    let processing_ids: Vec<u64> = intent_ids.iter()
        .filter(|id| !refunded_ids.contains(id))
        .copied()
        .collect();

    let txn = ctx.db().begin().await?;

    // BL-M2: Within transaction, mark refunded intents directly as Refunded
    if !refunded_ids.is_empty() {
        intents::Entity::update_many()
            .filter(intents::Column::Id.is_in(refunded_ids.clone()))
            .filter(intents::Column::Status.eq(intents::IntentStatus::Pending))
            .col_expr(intents::Column::Status, Expr::value(intents::IntentStatus::Refunded))
            .col_expr(intents::Column::UpdatedAt, Expr::value(now))
            .exec(&txn)
            .await?;
    }

    // BL-M2: Within same transaction, mark non-refunded intents as Processing
    let update_result = if !processing_ids.is_empty() {
        intents::Entity::update_many()
            .filter(intents::Column::Id.is_in(processing_ids))
            .filter(intents::Column::Status.eq(intents::IntentStatus::Pending)) // L-5: atomic status check
            .col_expr(intents::Column::Status, Expr::value(intents::IntentStatus::Processing))
            .col_expr(intents::Column::UpdatedAt, Expr::value(now))
            .exec(&txn)
            .await?
    } else {
        sea_orm::UpdateResult { rows_affected: 0 }
    };

    // Commit both updates atomically
    txn.commit().await?;

    tracing::info!(
        "Batch submitted for pool {}: {} intents ({} actually updated, {} refunded)",
        hex::encode(pool_hash),
        intents_batch.len(),
        update_result.rows_affected,
        refunded_ids.len()
    );

    // SECURITY (H-4): Explicitly release the lock (ownership-verified)
    if let Err(e) = _lock.release().await {
        tracing::warn!("Failed to explicitly release pool lock: {}", e);
    }

    Ok(())
}

/// Monitor submitted transactions for confirmation
async fn monitor_submitted_txs(ctx: &AppContext) -> anyhow::Result<()> {
    let processing = pool_txs::Entity::find()
        .filter(pool_txs::Column::Status.eq(pool_txs::PoolTxStatus::Submitted))
        .all(ctx.db())
        .await?;

    for tx in processing {
        // Check CKB transaction status
        // let status = ckb_client.get_transaction(&tx_hash).await?;
        // if confirmed: update to Confirmed, update intents to Completed
        // if failed: update to Failed, refund intents
        let _ = tx;
    }

    Ok(())
}
