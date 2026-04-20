use sea_orm::{
    ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set,
    ActiveModelTrait, TransactionTrait,
};
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use distributor_types::{
    DistributorTxStatus, MintTxStatus,
    parse_token_amount, checked_sub_amount, validate_ckb_address,
    SUBMITTED_TX_TIMEOUT_SECS,
};

mod security;
mod ckb_tx;

/// Config — sensitive fields redacted in Debug impl.
/// NOTE: `distributor_private_key` is consumed at startup and NOT passed to
/// background tasks.  Background tasks receive the key via Arc<SecurePrivateKey>.
#[derive(serde::Deserialize, Clone)]
struct Config {
    #[serde(default = "default_port")]
    port: u16,
    database_url: String,
    #[serde(default)]
    ckb_rpc_url: String,
    #[serde(default)]
    distributor_private_key: String,
}

// Custom Debug impl that redacts sensitive fields
impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("port", &self.port)
            .field("database_url", &"[REDACTED]")
            .field("ckb_rpc_url", &self.ckb_rpc_url)
            .field("distributor_private_key", &"[REDACTED]")
            .finish()
    }
}

/// Subset of Config that is safe to share with background tasks (no secrets).
#[derive(Clone)]
struct BgConfig {
    ckb_rpc_url: String,
    /// When `false`, the CKB submission path is considered unimplemented and
    /// worker loops MUST NOT transition records to `Submitted` (they will stay
    /// `Pending` and be re-tried).  Gate this with `ENABLE_CKB_SUBMISSION=true`
    /// once a real ckb-sdk integration is in place.
    submission_enabled: bool,
}

fn default_port() -> u16 { 8087 }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg: Config = envy::from_env()?;

    // --- Security: validate and secure the distributor private key ---
    let secure_key: Option<Arc<security::SecurePrivateKey>> =
        if !cfg.distributor_private_key.is_empty() {
            let key = security::SecurePrivateKey::from_hex(&cfg.distributor_private_key)
                .map_err(|e| anyhow::anyhow!("Invalid DISTRIBUTOR_PRIVATE_KEY: {}", e))?;
            tracing::info!("Distributor private key loaded and validated (32 bytes)");
            // Remove from process environment to limit exposure
            std::env::remove_var("DISTRIBUTOR_PRIVATE_KEY");
            Some(Arc::new(key))
        } else {
            tracing::warn!("DISTRIBUTOR_PRIVATE_KEY not set — distribution signing will fail");
            None
        };

    // --- Security: load API key from environment ---
    let distributor_api_key = std::env::var("DISTRIBUTOR_API_KEY")
        .unwrap_or_else(|_| {
            tracing::warn!("DISTRIBUTOR_API_KEY not set — all authenticated endpoints will be rejected");
            String::new()
        });

    // --- Security: load allowed CORS origins ---
    let cors_origins: Vec<String> = std::env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let db = sea_orm::Database::connect(&cfg.database_url).await?;

    // Build a BgConfig without the private key (FIX: don't clone plaintext key)
    let submission_enabled = std::env::var("ENABLE_CKB_SUBMISSION")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if !submission_enabled {
        tracing::warn!(
            "ENABLE_CKB_SUBMISSION is not set — worker will NOT broadcast distribution / mint \
             transactions to CKB. Set ENABLE_CKB_SUBMISSION=true and configure the CKB_* env \
             vars (see ckb_tx::load_ckb_config_from_env) to activate on-chain delivery."
        );
    }
    let bg_cfg = BgConfig {
        ckb_rpc_url: cfg.ckb_rpc_url.clone(),
        submission_enabled,
    };

    // Background: poll pending mint/distribute tasks
    let db_bg = db.clone();
    let key_bg = secure_key.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = process_distributions(&db_bg, &bg_cfg, key_bg.as_deref()).await {
                tracing::error!("Distribution error: {}", e);
            }
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });

    // Readiness: report ready iff the primary DB pool responds to a
    // lightweight ping. Extend `from_pairs` with more deps (CKB RPC,
    // Redis, ...) as they get added — a failing dep returns 503 so a
    // k8s readiness probe pulls the pod from Service endpoints without
    // killing it, letting the worker loop keep retrying.
    let db_ready = db.clone();
    let readiness = ReadinessCheck::new(move || {
        let db = db_ready.clone();
        async move {
            let (ok, detail) = match db.ping().await {
                Ok(()) => (true, None),
                Err(e) => (false, Some(e.to_string())),
            };
            ReadinessReport::from_pairs(&[("db", ok, detail)])
        }
    });

    tracing::info!("Starting token-distributor on port {}", cfg.port);
    let port = cfg.port;
    actix_web::HttpServer::new(move || {
        // --- CORS: restricted origins ---
        let mut cors = actix_cors::Cors::default()
            .allowed_methods(vec!["GET", "POST", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::HeaderName::from_static("x-api-key"),
            ])
            .max_age(3600);
        for origin in &cors_origins {
            cors = cors.allowed_origin(origin);
        }

        actix_web::App::new()
            .wrap(cors)
            .wrap(security::RateLimiter::new(60, 60)) // 60 req/min per IP
            .wrap(security::ApiKeyAuth::new(distributor_api_key.clone()))
            // Observability routes. ApiKeyAuth's skip-list in
            // security.rs lets these through without X-API-Key so
            // scrapers / probes don't need a shared secret.
            .app_data(actix_web::web::Data::new(prom_handle.clone()))
            .app_data(actix_web::web::Data::new(readiness.clone()))
            .route("/healthz", actix_web::web::get().to(health::healthz))
            .route("/readyz", actix_web::web::get().to(health::readyz))
            .route("/metrics", actix_web::web::get().to(obs_metrics::metrics_endpoint))
            // Legacy names kept for rollout overlap — remove after
            // every caller has migrated to /healthz.
            .route("/health", actix_web::web::get().to(health::healthz))
            .route("/status", actix_web::web::get().to(health::healthz))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await?;
    Ok(())
}

// ===========================================================================
// Core distribution loop — processes Pending and stuck-Submitted transactions
// ===========================================================================

async fn process_distributions(
    db: &sea_orm::DatabaseConnection,
    bg_cfg: &BgConfig,
    secure_key: Option<&security::SecurePrivateKey>,
) -> anyhow::Result<()> {
    tracing::debug!("Token distributor checking pending distributions...");

    // -----------------------------------------------------------------------
    // Step 0: Validate prerequisites
    // -----------------------------------------------------------------------
    let sign_key = match secure_key {
        Some(k) => k,
        None => {
            tracing::warn!("No signing key available — skipping distribution cycle");
            return Ok(());
        }
    };

    if bg_cfg.ckb_rpc_url.is_empty() {
        tracing::warn!("CKB RPC URL not configured — skipping distribution cycle");
        return Ok(());
    }

    // -----------------------------------------------------------------------
    // Step 1: Recover stuck "Submitted" transactions (timeout → re-check)
    // -----------------------------------------------------------------------
    recover_stuck_submitted_txs(db).await?;

    // -----------------------------------------------------------------------
    // Step 2: Query pending distributor_tx records (oldest first, batch of 50)
    // -----------------------------------------------------------------------
    let pending_txs = distributor_daos::distributor_tx::Entity::find()
        .filter(distributor_daos::distributor_tx::Column::Status.eq(DistributorTxStatus::Pending.as_str()))
        .order_by_asc(distributor_daos::distributor_tx::Column::CreatedAt)
        .all(db)
        .await?;

    if pending_txs.is_empty() {
        return Ok(());
    }

    tracing::info!("Found {} pending distribution(s)", pending_txs.len());

    // Process up to 50 per cycle to avoid overwhelming the node
    let batch = if pending_txs.len() > 50 { &pending_txs[..50] } else { &pending_txs };

    for tx_record in batch {
        if let Err(e) = process_single_distribution(db, bg_cfg, sign_key, tx_record).await {
            tracing::error!(
                "Failed to process distribution tx id={}: {}",
                tx_record.id, e
            );
            // Mark as Failed so it doesn't block the queue forever
            mark_tx_failed(db, tx_record.id, &format!("Processing error: {}", e)).await;
        }
    }

    // -----------------------------------------------------------------------
    // Step 3: Process pending mint_tx records
    // -----------------------------------------------------------------------
    let pending_mints = distributor_daos::mint_tx::Entity::find()
        .filter(distributor_daos::mint_tx::Column::Status.eq(MintTxStatus::Pending.as_str()))
        .order_by_asc(distributor_daos::mint_tx::Column::CreatedAt)
        .all(db)
        .await?;

    for mint_record in pending_mints.iter().take(50) {
        if let Err(e) = process_single_mint(db, bg_cfg, sign_key, mint_record).await {
            tracing::error!(
                "Failed to process mint tx id={}: {}",
                mint_record.id, e
            );
            mark_mint_failed(db, mint_record.id, &format!("Processing error: {}", e)).await;
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Process a single distribution transaction
// ---------------------------------------------------------------------------
async fn process_single_distribution(
    db: &sea_orm::DatabaseConnection,
    bg_cfg: &BgConfig,
    sign_key: &security::SecurePrivateKey,
    tx_record: &distributor_daos::distributor_tx::Model,
) -> anyhow::Result<()> {
    // --- Input validation ---
    let amount = parse_token_amount(&tx_record.amount)
        .ok_or_else(|| anyhow::anyhow!(
            "Invalid distribution amount '{}' for tx id={}",
            tx_record.amount, tx_record.id
        ))?;

    if amount == 0 {
        return Err(anyhow::anyhow!("Distribution amount is zero for tx id={}", tx_record.id));
    }

    if !validate_ckb_address(&tx_record.recipient_address) {
        return Err(anyhow::anyhow!(
            "Invalid recipient address '{}' for tx id={}",
            tx_record.recipient_address, tx_record.id
        ));
    }

    // --- Idempotency: verify tx is still Pending (prevent double-distribution) ---
    let current = distributor_daos::distributor_tx::Entity::find_by_id(tx_record.id)
        .one(db)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Tx id={} disappeared from DB", tx_record.id))?;

    if current.status != DistributorTxStatus::Pending.as_str() {
        tracing::warn!(
            "Tx id={} status changed to '{}' — skipping (race condition avoided)",
            tx_record.id, current.status
        );
        return Ok(());
    }

    // --- Check remaining balance in distributor_token ---
    let dist_token = distributor_daos::distributor_token::Entity::find()
        .filter(distributor_daos::distributor_token::Column::TokenId.eq(tx_record.token_id))
        .one(db)
        .await?
        .ok_or_else(|| anyhow::anyhow!(
            "No distributor_token record for token_id={}", tx_record.token_id
        ))?;

    let remaining = parse_token_amount(&dist_token.remaining_amount)
        .ok_or_else(|| anyhow::anyhow!(
            "Invalid remaining_amount '{}' for distributor_token id={}",
            dist_token.remaining_amount, dist_token.id
        ))?;

    let new_remaining = checked_sub_amount(remaining, amount)
        .ok_or_else(|| anyhow::anyhow!(
            "Insufficient remaining balance: have {} but need {} for tx id={}",
            remaining, amount, tx_record.id
        ))?;

    tracing::info!(
        "Building CKB transaction: distribute {} tokens (token_id={}) to {}",
        amount, tx_record.token_id, tx_record.recipient_address
    );

    // --- Atomically update status to Submitted + deduct remaining ---
    let txn = db.begin().await?;

    // Re-check status inside transaction (double-check locking)
    let recheck = distributor_daos::distributor_tx::Entity::find_by_id(tx_record.id)
        .one(&txn)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Tx id={} disappeared", tx_record.id))?;

    if recheck.status != DistributorTxStatus::Pending.as_str() {
        txn.rollback().await?;
        tracing::warn!("Tx id={} already processed — rolling back", tx_record.id);
        return Ok(());
    }

    // SAFETY GUARD: never advance to `Submitted` unless on-chain submission is
    // enabled. Without it nothing reaches CKB and the DB would lie.
    if !bg_cfg.submission_enabled {
        txn.rollback().await?;
        tracing::warn!(
            "Tx id={} left in Pending — set ENABLE_CKB_SUBMISSION=true and configure CKB_* env vars",
            tx_record.id
        );
        return Ok(());
    }

    // --- Build, sign, and submit the on-chain xUDT transfer ---
    let ckb_cfg = ckb_tx::load_ckb_config_from_env()
        .map_err(|e| anyhow::anyhow!("CKB config incomplete (tx id={}): {}", tx_record.id, e))?;
    let on_chain_hash = match ckb_tx::distribute_xudt(
        &ckb_cfg,
        &tx_record.recipient_address,
        amount,
        /* fee_shannons */ 10_000,
        sign_key.as_bytes(),
    ).await {
        Ok(h) => h,
        Err(e) => {
            txn.rollback().await?;
            return Err(anyhow::anyhow!("CKB submission failed for tx id={}: {}", tx_record.id, e));
        }
    };

    // Persist the chain tx_hash and advance to Submitted.
    let mut active_tx: distributor_daos::distributor_tx::ActiveModel = recheck.into();
    active_tx.status = Set(DistributorTxStatus::Submitted.as_str().to_string());
    active_tx.tx_hash = Set(Some(on_chain_hash.clone()));
    active_tx.updated_at = Set(chrono::Utc::now().naive_utc());
    active_tx.update(&txn).await?;

    // Deduct from remaining_amount (overflow-safe)
    let mut active_token: distributor_daos::distributor_token::ActiveModel = dist_token.into();
    active_token.remaining_amount = Set(new_remaining.to_string());
    active_token.update(&txn).await?;

    txn.commit().await?;

    tracing::info!(
        "Distribution tx id={} broadcast (hash={}), remaining balance: {}",
        tx_record.id, on_chain_hash, new_remaining
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// Process a single mint transaction
// ---------------------------------------------------------------------------
async fn process_single_mint(
    db: &sea_orm::DatabaseConnection,
    bg_cfg: &BgConfig,
    sign_key: &security::SecurePrivateKey,
    mint_record: &distributor_daos::mint_tx::Model,
) -> anyhow::Result<()> {
    let mint_amount = parse_token_amount(&mint_record.mint_amount)
        .ok_or_else(|| anyhow::anyhow!(
            "Invalid mint_amount '{}' for mint_tx id={}",
            mint_record.mint_amount, mint_record.id
        ))?;

    if mint_amount == 0 {
        return Err(anyhow::anyhow!("Mint amount is zero for mint_tx id={}", mint_record.id));
    }

    // Idempotency: re-check status
    let current = distributor_daos::mint_tx::Entity::find_by_id(mint_record.id)
        .one(db)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Mint tx id={} disappeared", mint_record.id))?;

    if current.status != MintTxStatus::Pending.as_str() {
        tracing::warn!("Mint tx id={} status changed — skipping", mint_record.id);
        return Ok(());
    }

    tracing::info!(
        "Building CKB mint transaction: mint {} tokens (token_id={})",
        mint_amount, mint_record.token_id
    );

    // SAFETY GUARD: same as process_single_distribution.
    if !bg_cfg.submission_enabled {
        tracing::warn!(
            "Mint tx id={} left in Pending — set ENABLE_CKB_SUBMISSION=true to enable broadcasting",
            mint_record.id
        );
        return Ok(());
    }

    // xUDT minting is performed by the issuer's owner-lock signing a transfer
    // out of an issuer cell. The xUDT spec defines `xudt_args = blake2b(owner_lock_hash)`,
    // so the same `distribute_xudt` builder works as long as the configured
    // CKB_DISTRIBUTOR_LOCK_ARG corresponds to the issuer lock for this token.
    // The recipient of a mint is itself (the issuer's cell becomes the source
    // of further distributions), so we read the recipient address from the
    // mint_tx record. If the schema doesn't carry an explicit recipient, the
    // distributor's own address is used.
    let recipient = std::env::var("CKB_DISTRIBUTOR_ADDRESS")
        .map_err(|_| anyhow::anyhow!(
            "mint_tx id={} requires CKB_DISTRIBUTOR_ADDRESS env var (issuer's own CKB address)",
            mint_record.id
        ))?;
    let ckb_cfg = ckb_tx::load_ckb_config_from_env()
        .map_err(|e| anyhow::anyhow!("CKB config incomplete (mint id={}): {}", mint_record.id, e))?;
    let on_chain_hash = ckb_tx::distribute_xudt(
        &ckb_cfg,
        &recipient,
        mint_amount,
        /* fee_shannons */ 10_000,
        sign_key.as_bytes(),
    ).await
     .map_err(|e| anyhow::anyhow!("CKB mint submission failed (id={}): {}", mint_record.id, e))?;
    // Update status to Submitted
    let mut active: distributor_daos::mint_tx::ActiveModel = current.into();
    active.status = Set(MintTxStatus::Submitted.as_str().to_string());
    active.tx_hash = Set(Some(on_chain_hash.clone()));
    active.updated_at = Set(chrono::Utc::now().naive_utc());
    active.update(db).await?;

    tracing::info!("Mint tx id={} broadcast (hash={})", mint_record.id, on_chain_hash);
    Ok(())
}

// ---------------------------------------------------------------------------
// Recover stuck "Submitted" transactions that exceeded timeout
// ---------------------------------------------------------------------------
async fn recover_stuck_submitted_txs(
    db: &sea_orm::DatabaseConnection,
) -> anyhow::Result<()> {
    let cutoff = chrono::Utc::now().naive_utc()
        - chrono::Duration::seconds(SUBMITTED_TX_TIMEOUT_SECS);

    let stuck_txs = distributor_daos::distributor_tx::Entity::find()
        .filter(distributor_daos::distributor_tx::Column::Status.eq(DistributorTxStatus::Submitted.as_str()))
        .filter(distributor_daos::distributor_tx::Column::UpdatedAt.lt(cutoff))
        .all(db)
        .await?;

    for tx in &stuck_txs {
        tracing::warn!(
            "Distribution tx id={} stuck in Submitted since {} — marking Failed for retry",
            tx.id, tx.updated_at
        );
        // If tx_hash is set, we should check on-chain status before failing.
        // If no tx_hash, it never actually submitted.
        if let Some(hash_bytes) = &tx.tx_hash {
            // Query the CKB node to verify the tx is actually committed before
            // marking it failed. If committed, we promote it to Confirmed; if
            // still unknown after the timeout, we treat it as Failed.
            let hash_hex = format!("0x{}", hex::encode(hash_bytes));
            // RPC URL may be empty in dev — skip live check in that case.
            let rpc_url = std::env::var("CKB_RPC_URL").unwrap_or_default();
            if !rpc_url.is_empty() {
                match ckb_tx::get_transaction_status(&rpc_url, &hash_hex).await {
                    Ok(Some(true)) => {
                        tracing::info!("Tx id={} found committed on-chain (hash={}) — promoting to Confirmed", tx.id, hash_hex);
                        if let Some(rec) = distributor_daos::distributor_tx::Entity::find_by_id(tx.id).one(db).await.ok().flatten() {
                            let mut active: distributor_daos::distributor_tx::ActiveModel = rec.into();
                            active.status = Set(DistributorTxStatus::Confirmed.as_str().to_string());
                            active.updated_at = Set(chrono::Utc::now().naive_utc());
                            let _ = active.update(db).await;
                        }
                        continue;
                    }
                    Ok(Some(false)) | Ok(None) => {
                        tracing::warn!("Tx id={} not yet committed (hash={}) — marking Failed for retry", tx.id, hash_hex);
                    }
                    Err(e) => {
                        tracing::error!("Tx id={} status check failed ({}): {}", tx.id, hash_hex, e);
                    }
                }
            } else {
                tracing::warn!("Tx id={} has hash={} but CKB_RPC_URL unset — marking Failed", tx.id, hash_hex);
            }
        }
        mark_tx_failed(db, tx.id, "Timed out in Submitted status").await;
    }

    // Same for mint_tx
    let stuck_mints = distributor_daos::mint_tx::Entity::find()
        .filter(distributor_daos::mint_tx::Column::Status.eq(MintTxStatus::Submitted.as_str()))
        .filter(distributor_daos::mint_tx::Column::UpdatedAt.lt(cutoff))
        .all(db)
        .await?;

    for mint in &stuck_mints {
        tracing::warn!(
            "Mint tx id={} stuck in Submitted since {} — marking Failed",
            mint.id, mint.updated_at
        );
        mark_mint_failed(db, mint.id, "Timed out in Submitted status").await;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Helper: mark a distributor_tx as Failed
//
// If the tx was previously moved to Submitted but never got an on-chain
// `tx_hash` (i.e. nothing was actually submitted to CKB), refund the
// deducted amount back to the owning distributor_token. Without this,
// every timeout permanently burns token balance because
// `process_single_distribution` deducts eagerly at Pending→Submitted.
// ---------------------------------------------------------------------------
async fn mark_tx_failed(db: &sea_orm::DatabaseConnection, id: u64, reason: &str) {
    tracing::error!("Marking distributor_tx id={} as Failed: {}", id, reason);

    let record = match distributor_daos::distributor_tx::Entity::find_by_id(id).one(db).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            tracing::error!("Cannot mark tx id={} as Failed — record not found", id);
            return;
        }
        Err(e) => {
            tracing::error!("DB error looking up tx id={}: {}", id, e);
            return;
        }
    };

    // Only refund if we previously deducted (Submitted) AND nothing actually
    // reached the chain (no tx_hash recorded).
    let should_refund = record.status == DistributorTxStatus::Submitted.as_str()
        && record.tx_hash.is_none();

    // Wrap status update + refund in a single DB transaction.
    let txn = match db.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to begin refund transaction for tx id={}: {}", id, e);
            return;
        }
    };

    if should_refund {
        match distributor_daos::distributor_token::Entity::find()
            .filter(distributor_daos::distributor_token::Column::TokenId.eq(record.token_id))
            .one(&txn)
            .await
        {
            Ok(Some(dist_token)) => {
                if let (Some(remaining), Some(amount)) = (
                    parse_token_amount(&dist_token.remaining_amount),
                    parse_token_amount(&record.amount),
                ) {
                    let refunded = remaining.saturating_add(amount);
                    let mut active_token: distributor_daos::distributor_token::ActiveModel =
                        dist_token.into();
                    active_token.remaining_amount = Set(refunded.to_string());
                    if let Err(e) = active_token.update(&txn).await {
                        tracing::error!(
                            "Refund update failed for tx id={} token_id={}: {}",
                            id,
                            record.token_id,
                            e
                        );
                        let _ = txn.rollback().await;
                        return;
                    }
                    tracing::warn!(
                        "Refunded {} tokens to token_id={} for failed tx id={}",
                        amount,
                        record.token_id,
                        id
                    );
                } else {
                    tracing::error!(
                        "Cannot refund tx id={}: unparseable amounts (remaining='{}', tx='{}')",
                        id,
                        dist_token.remaining_amount,
                        record.amount
                    );
                }
            }
            Ok(None) => {
                tracing::error!(
                    "Cannot refund tx id={}: no distributor_token for token_id={}",
                    id,
                    record.token_id
                );
            }
            Err(e) => {
                tracing::error!("DB error during refund for tx id={}: {}", id, e);
                let _ = txn.rollback().await;
                return;
            }
        }
    }

    let mut active: distributor_daos::distributor_tx::ActiveModel = record.into();
    active.status = Set(DistributorTxStatus::Failed.as_str().to_string());
    active.updated_at = Set(chrono::Utc::now().naive_utc());
    if let Err(e) = active.update(&txn).await {
        tracing::error!("Failed to update tx id={} status to Failed: {}", id, e);
        let _ = txn.rollback().await;
        return;
    }

    if let Err(e) = txn.commit().await {
        tracing::error!("Failed to commit refund+fail for tx id={}: {}", id, e);
    } else {
        tracing::info!("tx id={} marked Failed (refund_applied={}): {}", id, should_refund, reason);
    }
}

// ---------------------------------------------------------------------------
// Helper: mark a mint_tx as Failed
// ---------------------------------------------------------------------------
async fn mark_mint_failed(db: &sea_orm::DatabaseConnection, id: u64, reason: &str) {
    tracing::error!("Marking mint_tx id={} as Failed: {}", id, reason);
    let result = distributor_daos::mint_tx::Entity::find_by_id(id)
        .one(db)
        .await;
    match result {
        Ok(Some(record)) => {
            let mut active: distributor_daos::mint_tx::ActiveModel = record.into();
            active.status = Set(MintTxStatus::Failed.as_str().to_string());
            active.updated_at = Set(chrono::Utc::now().naive_utc());
            if let Err(e) = active.update(db).await {
                tracing::error!("Failed to update mint_tx id={} status to Failed: {}", id, e);
            }
        }
        Ok(None) => {
            tracing::error!("Cannot mark mint_tx id={} as Failed — record not found", id);
        }
        Err(e) => {
            tracing::error!("DB error looking up mint_tx id={}: {}", id, e);
        }
    }
}
