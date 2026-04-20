use anyhow::Result;

/// Build CKB batch transaction for farm operations.
///
/// **Stub — HIGH-FM-3 functional gap.** Both arguments are the
/// inputs the real implementation will need (pool cell data to
/// mutate reward accumulator; intent cells to consume); the
/// current body just returns a 4-byte version placeholder so the
/// workspace builds. Callers sit behind the
/// `FARM_PROCESSING_ENABLED=false` fail-closed gate, so this stub
/// never runs in production.
///
/// The `_` prefix on `_pool_cell_data` silences the unused-variable
/// warning without renaming the public parameter — the real
/// implementation will drop the prefix in the same PR that makes
/// it a real function.
pub fn build_farm_batch_tx(
    _pool_cell_data: &[u8],
    intent_cells: &[Vec<u8>],
) -> Result<Vec<u8>> {
    let intent_count = intent_cells.len();
    let mut tx_bytes = Vec::new();
    tx_bytes.extend_from_slice(&0u32.to_le_bytes()); // version
    tracing::info!("Built farm batch tx with {} intents", intent_count);
    Ok(tx_bytes)
}
