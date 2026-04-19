/// Check for pending create_pool intents and process them
pub async fn check_pending_creations(db: &sea_orm::DatabaseConnection) -> anyhow::Result<()> {
    use entity_crate::farm_intents;
    use sea_orm::*;
    let pending = farm_intents::Entity::find()
        .filter(farm_intents::Column::Status.eq(farm_intents::FarmIntentStatus::Pending))
        .all(db).await?;
    tracing::debug!("Found {} pending farm pool creation intents", pending.len());
    Ok(())
}
