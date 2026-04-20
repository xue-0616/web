/// Intent DAO — database operations for intents
use entity_crate::intents;
use sea_orm::*;
use sea_orm::sea_query::Expr;

pub async fn find_pending_by_pool(
    db: &DatabaseConnection,
    pool_hash: &[u8],
) -> Result<Vec<intents::Model>, DbErr> {
    intents::Entity::find()
        .filter(intents::Column::PoolTypeHash.eq(pool_hash))
        .filter(intents::Column::Status.eq(intents::IntentStatus::Pending))
        .order_by_asc(intents::Column::CreatedAt)
        .all(db)
        .await
}

pub async fn update_status(
    db: &DatabaseConnection,
    intent_id: u64,
    status: intents::IntentStatus,
    _error_reason: Option<serde_json::Value>,
) -> Result<(), DbErr> {
    let now = chrono::Utc::now().naive_utc();
    intents::Entity::update_many()
        .filter(intents::Column::Id.eq(intent_id))
        .col_expr(intents::Column::Status, Expr::value(status))
        .col_expr(intents::Column::UpdatedAt, Expr::value(now))
        .exec(db)
        .await?;
    Ok(())
}
