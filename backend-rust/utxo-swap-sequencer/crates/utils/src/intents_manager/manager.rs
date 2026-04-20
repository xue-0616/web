use anyhow::Result;
use entity_crate::intents;
use entity_crate::intents::IntentStatus;
use sea_orm::*;
use sea_orm::sea_query::Expr;

/// Manages intent lifecycle — create, match, batch, submit
pub struct IntentsManager {
    db: DatabaseConnection,
}

impl IntentsManager {
    pub fn new(db: DatabaseConnection) -> Self { Self { db } }

    /// Get pending intents for a pool, ordered by creation time
    pub async fn get_pending_intents(&self, pool_type_hash: &[u8; 32]) -> Result<Vec<intents::Model>> {
        let results = intents::Entity::find()
            .filter(intents::Column::PoolTypeHash.eq(pool_type_hash.to_vec()))
            .filter(intents::Column::Status.eq(IntentStatus::Pending))
            .order_by_asc(intents::Column::CreatedAt)
            .all(&self.db)
            .await?;
        Ok(results)
    }

    /// Get pending intent IDs for a pool
    pub async fn get_pending_intent_ids(&self, pool_type_hash: &[u8; 32]) -> Result<Vec<u64>> {
        let intents = self.get_pending_intents(pool_type_hash).await?;
        Ok(intents.iter().map(|i| i.id).collect())
    }

    /// Atomically claim a batch of intents for processing.
    ///
    /// HIGH-SW-4: the previous version returned `()`. That signature
    /// was a trap — it filtered on `status = Pending` so it was
    /// race-safe at the SQL level, but because the caller never saw
    /// how many rows actually flipped, two workers racing on the
    /// same intent batch could both believe they "won". One would
    /// build a batch CKB transaction against intents another worker
    /// had already staked out, producing duplicate work at best and
    /// a double-broadcast at worst.
    ///
    /// The new signature forces every caller to deal with the
    /// truth: returns the list of intent IDs whose status was
    /// flipped `Pending -> Processing` in this call. IDs missing
    /// from the result were either already processing, already
    /// completed, or never existed — the caller must NOT build a
    /// transaction against them.
    ///
    /// Implementation: MySQL has no `UPDATE … RETURNING`, so the
    /// claim runs inside a transaction as `SELECT … FOR UPDATE`
    /// followed by `UPDATE … WHERE id IN (<selected>)`. The row
    /// lock held by `FOR UPDATE` keeps any concurrent worker from
    /// observing the same rows as Pending, which is what makes the
    /// returned set authoritative.
    pub async fn claim_for_processing(&self, intent_ids: &[u64]) -> Result<Vec<u64>> {
        if intent_ids.is_empty() {
            return Ok(Vec::new());
        }

        let txn = self.db.begin().await?;

        // Lock the rows we're about to claim. Only rows still in
        // Pending state are returned; other workers' already-claimed
        // rows are silently excluded.
        let claimable: Vec<u64> = intents::Entity::find()
            .select_only()
            .column(intents::Column::Id)
            .filter(intents::Column::Id.is_in(intent_ids.to_vec()))
            .filter(intents::Column::Status.eq(IntentStatus::Pending))
            .lock_exclusive()
            .into_tuple::<u64>()
            .all(&txn)
            .await?;

        if claimable.is_empty() {
            // Nothing to claim; commit (or drop) the empty txn.
            txn.commit().await?;
            return Ok(Vec::new());
        }

        intents::Entity::update_many()
            .col_expr(intents::Column::Status, Expr::value(IntentStatus::Processing))
            .filter(intents::Column::Id.is_in(claimable.clone()))
            .exec(&txn)
            .await?;

        txn.commit().await?;
        Ok(claimable)
    }

    /// Deprecated wrapper kept for source compatibility with any
    /// decompiled caller we haven't audited yet. DO NOT add new
    /// call sites — use `claim_for_processing` and handle the
    /// returned set. This wrapper PANICS in debug builds if any
    /// caller passes a non-empty `intent_ids` so that the binary
    /// fails loudly during test if someone reintroduces this API.
    #[deprecated(
        since = "0.2.0",
        note = "race-unsafe: use claim_for_processing and inspect the returned IDs"
    )]
    #[doc(hidden)]
    pub async fn mark_processing(&self, intent_ids: &[u64]) -> Result<()> {
        debug_assert!(
            intent_ids.is_empty(),
            "mark_processing is deprecated; migrate to claim_for_processing (HIGH-SW-4)"
        );
        self.claim_for_processing(intent_ids).await.map(|_| ())
    }

    /// Mark intents as completed with pool tx hash
    pub async fn mark_completed(&self, intent_ids: &[u64], tx_hash: &[u8; 32]) -> Result<()> {
        if intent_ids.is_empty() {
            return Ok(());
        }
        intents::Entity::update_many()
            .col_expr(intents::Column::Status, Expr::value(IntentStatus::Completed))
            .col_expr(intents::Column::PoolTxHash, Expr::value(Some(tx_hash.to_vec())))
            .filter(intents::Column::Id.is_in(intent_ids.to_vec()))
            .exec(&self.db)
            .await?;
        Ok(())
    }

    /// Mark intents as failed with error reason
    pub async fn mark_failed(&self, intent_ids: &[u64], reason: &str) -> Result<()> {
        if intent_ids.is_empty() {
            return Ok(());
        }
        let error_json = serde_json::json!({ "reason": reason });
        intents::Entity::update_many()
            .col_expr(intents::Column::Status, Expr::value(IntentStatus::Failed))
            .col_expr(intents::Column::ErrorReason, Expr::value(Some(error_json)))
            .filter(intents::Column::Id.is_in(intent_ids.to_vec()))
            .exec(&self.db)
            .await?;
        Ok(())
    }

    /// Mark intents as refunded
    pub async fn mark_refunded(&self, intent_ids: &[u64]) -> Result<()> {
        if intent_ids.is_empty() {
            return Ok(());
        }
        intents::Entity::update_many()
            .col_expr(intents::Column::Status, Expr::value(IntentStatus::Refunded))
            .filter(intents::Column::Id.is_in(intent_ids.to_vec()))
            .exec(&self.db)
            .await?;
        Ok(())
    }

    /// Get intent by ID
    pub async fn get_intent(&self, id: u64) -> Result<Option<intents::Model>> {
        Ok(intents::Entity::find_by_id(id).one(&self.db).await?)
    }
}
