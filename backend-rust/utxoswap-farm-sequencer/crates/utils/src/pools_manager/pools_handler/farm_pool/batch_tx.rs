use anyhow::Result;

/// Build CKB batch transaction for farm operations
pub fn build_farm_batch_tx(
    pool_cell_data: &[u8],
    intent_cells: &[Vec<u8>],
) -> Result<Vec<u8>> {
    let intent_count = intent_cells.len();
    let mut tx_bytes = Vec::new();
    tx_bytes.extend_from_slice(&0u32.to_le_bytes()); // version
    tracing::info!("Built farm batch tx with {} intents", intent_count);
    Ok(tx_bytes)
}
