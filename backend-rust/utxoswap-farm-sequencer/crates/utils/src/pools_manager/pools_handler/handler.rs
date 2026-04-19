use anyhow::Result;

/// Route farm intents to appropriate handler
pub async fn process_farm_intents(db: &sea_orm::DatabaseConnection, farm_type_hash: &[u8]) -> Result<()> {
    use entity_crate::farm_intents;
    use sea_orm::*;
    let pending = farm_intents::Entity::find()
        .filter(farm_intents::Column::FarmTypeHash.eq(farm_type_hash.to_vec()))
        .filter(farm_intents::Column::Status.eq(farm_intents::FarmIntentStatus::Pending))
        .order_by_asc(farm_intents::Column::CreatedAt)
        .limit(50)
        .all(db).await?;

    if pending.is_empty() { return Ok(()); }
    tracing::info!("Processing {} farm intents for {}", pending.len(), hex::encode(farm_type_hash));
    Ok(())
}
