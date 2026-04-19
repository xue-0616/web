use api_common::context::AppContext;
use anyhow::Result;

/// Background loop entry point called from main.rs
pub async fn start(ctx: AppContext) -> Result<()> {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(3));
    loop {
        interval.tick().await;
        if let Err(e) = process_all_farms(&ctx).await {
            tracing::error!("Farm pools processing error: {}", e);
        }
    }
}

/// Main farm pools processing loop
pub async fn process_all_farms(ctx: &AppContext) -> Result<()> {
    use entity_crate::farm_pools;
    use sea_orm::*;
    let active_farms = farm_pools::Entity::find()
        .all(ctx.db()).await?;

    for farm in active_farms {
        let farm_hash = hex::encode(&farm.farm_type_hash);
        tracing::debug!("Checking farm pool: {}", farm_hash);
    }
    Ok(())
}
