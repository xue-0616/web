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

    /// Mark intents as processing (atomically)
    pub async fn mark_processing(&self, intent_ids: &[u64]) -> Result<()> {
        if intent_ids.is_empty() {
            return Ok(());
        }
        intents::Entity::update_many()
            .col_expr(intents::Column::Status, Expr::value(IntentStatus::Processing))
            .filter(intents::Column::Id.is_in(intent_ids.to_vec()))
            .filter(intents::Column::Status.eq(IntentStatus::Pending))
            .exec(&self.db)
            .await?;
        Ok(())
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
