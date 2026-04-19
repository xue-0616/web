/// Bridge validation utilities

/// Verify that a tx hash is valid hex format
pub fn is_valid_tx_hash(hash: &str) -> bool {
    let h = hash.trim_start_matches("0x");
    h.len() == 64 && h.chars().all(|c| c.is_ascii_hexdigit())
}

/// Verify that an address is valid EVM format
pub fn is_valid_address(addr: &str) -> bool {
    let a = addr.trim_start_matches("0x");
    a.len() == 40 && a.chars().all(|c| c.is_ascii_hexdigit())
}
