use anyhow::Result;

/// Create a new farm pool on CKB
pub async fn create_farm_pool(params: &serde_json::Value) -> Result<()> {
    tracing::info!("Creating new farm pool: {:?}", params);
    Ok(())
}
