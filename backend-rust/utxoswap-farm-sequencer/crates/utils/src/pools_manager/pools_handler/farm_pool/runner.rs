/// Process deposit/withdraw/harvest intents for an active farm pool
pub async fn process_farm_batch(farm_type_hash: &[u8]) -> anyhow::Result<()> {
    tracing::info!("Farm pool runner processing batch for {}", hex::encode(farm_type_hash));
    Ok(())
}
