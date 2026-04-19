// Parse ModuleGuest execute calls for payment transactions
// FINDING-13: All array accesses use bounds-checked .get() to prevent panics on malformed input.

// ModuleGuest execute calldata parsing
// ABI: execute(address dest, uint256 value, bytes calldata)
// Selector: 0xb61d27f6

pub fn decode_execute_calldata(calldata: &[u8]) -> anyhow::Result<(Vec<u8>, [u8; 32], Vec<u8>)> {
    // Minimum length: 4 (selector) + 32*3 (dest, value, data_offset) = 100 bytes
    if calldata.len() < 4 + 32 * 3 {
        anyhow::bail!("Calldata too short for execute(): got {} bytes, need at least 100", calldata.len());
    }

    let selector = calldata.get(0..4)
        .ok_or_else(|| anyhow::anyhow!("Failed to read selector"))?;
    if selector != [0xb6, 0x1d, 0x27, 0xf6] {
        anyhow::bail!("Not execute() selector: 0x{}", hex::encode(selector));
    }

    // address (20 bytes, left-padded in 32-byte slot at offset 4..36)
    let dest = calldata.get(16..36)
        .ok_or_else(|| anyhow::anyhow!("Calldata too short to read dest address (need bytes 16..36)"))?
        .to_vec();

    // uint256 value at offset 36..68
    let value_slice = calldata.get(36..68)
        .ok_or_else(|| anyhow::anyhow!("Calldata too short to read value (need bytes 36..68)"))?;
    let mut value = [0u8; 32];
    value.copy_from_slice(value_slice);

    // data offset is stored at offset 68..100 (third 32-byte ABI param)
    // The offset value itself is in the last 8 bytes of the 32-byte word (big-endian u64)
    let offset_bytes = calldata.get(92..100)
        .ok_or_else(|| anyhow::anyhow!("Calldata too short to read data_offset (need bytes 92..100)"))?;
    let data_offset = u64::from_be_bytes(offset_bytes.try_into()?) as usize;

    // Validate data_offset is within bounds: we need at least data_offset + 36 bytes
    if data_offset + 36 > calldata.len() {
        anyhow::bail!(
            "data_offset ({}) + 36 exceeds calldata length ({})",
            data_offset, calldata.len()
        );
    }

    // data_len is stored at data_offset + 0..32 (last 8 bytes of 32-byte word)
    let len_bytes = calldata.get(data_offset + 28..data_offset + 36)
        .ok_or_else(|| anyhow::anyhow!(
            "Calldata too short to read data_len at offset {}..{}",
            data_offset + 28, data_offset + 36
        ))?;
    let data_len = u64::from_be_bytes(len_bytes.try_into()?) as usize;

    // Validate that the full data slice is within bounds
    let data_start = data_offset + 36;
    let data_end = data_start.checked_add(data_len)
        .ok_or_else(|| anyhow::anyhow!("data_len overflow: {} + {} overflows usize", data_start, data_len))?;

    if data_end > calldata.len() {
        anyhow::bail!(
            "Data slice out of bounds: data_offset({}) + 36 + data_len({}) = {} > calldata.len() ({})",
            data_offset, data_len, data_end, calldata.len()
        );
    }

    let data = calldata.get(data_start..data_end)
        .ok_or_else(|| anyhow::anyhow!("Failed to read data bytes"))?
        .to_vec();

    Ok((dest, value, data))
}
// abigen!(ModuleGuestExecute, "abi/module_guest_execute.json");
