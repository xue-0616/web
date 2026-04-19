/// General utility functions

/// Hex encode bytes
pub fn to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// Hex decode string
pub fn from_hex(s: &str) -> anyhow::Result<Vec<u8>> {
    Ok(hex::decode(s.trim_start_matches("0x"))?)
}
