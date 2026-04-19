pub fn hex_to_bytes(hex_str: &str) -> Result<Vec<u8>, hex::FromHexError> {
    let s = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    hex::decode(s)
}

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(bytes))
}
