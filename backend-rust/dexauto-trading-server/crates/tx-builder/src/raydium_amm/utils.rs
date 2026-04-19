/// Decode base64 account data from Solana RPC response
pub fn decode_account_data(data: &str) -> anyhow::Result<Vec<u8>> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(data)?;
    Ok(bytes)
}

/// Read u64 from little-endian bytes at offset.
///
/// Returns an error instead of panicking when `data` is too short (Audit #38).
pub fn read_u64_le(data: &[u8], offset: usize) -> anyhow::Result<u64> {
    let end = offset.checked_add(8).ok_or_else(|| {
        anyhow::anyhow!("read_u64_le: offset {} + 8 overflows usize", offset)
    })?;
    if data.len() < end {
        anyhow::bail!(
            "read_u64_le: data length {} too short for offset {} (need {})",
            data.len(), offset, end,
        );
    }
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&data[offset..end]);
    Ok(u64::from_le_bytes(buf))
}
