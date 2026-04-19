/// General payment-server utility functions

pub fn mask_address(addr: &str) -> String {
    if addr.len() > 10 {
        format!("{}...{}", &addr[..6], &addr[addr.len()-4..])
    } else {
        addr.to_string()
    }
}

/// Convert wei (integer string) to ether string with fixed precision.
/// FINDING-14: Uses u128 integer division for whole part, avoids f64 precision loss.
/// Returns a formatted string like "1.234567890000000000".
pub fn wei_to_ether(wei: &str) -> String {
    let w: u128 = wei.parse().unwrap_or(0);
    let ether_whole = w / 1_000_000_000_000_000_000u128;
    let ether_frac = w % 1_000_000_000_000_000_000u128;
    format!("{}.{:018}", ether_whole, ether_frac)
}

/// Convert wei string to a display-friendly ether value (truncated to 8 decimals).
pub fn wei_to_ether_display(wei: &str) -> String {
    let full = wei_to_ether(wei);
    // Truncate to 8 decimal places for display
    if let Some(dot_pos) = full.find('.') {
        let end = std::cmp::min(full.len(), dot_pos + 9); // 8 decimals + dot
        full[..end].to_string()
    } else {
        full
    }
}
