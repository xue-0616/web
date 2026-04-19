pub mod auth;
pub mod context;
pub mod crypto;
pub mod payment;

/// Mask an address/hash for safe logging: show first 6 + last 4 chars.
pub fn mask_address(addr: &str) -> String {
    if addr.len() > 10 {
        format!("{}...{}", &addr[..6], &addr[addr.len()-4..])
    } else {
        addr.to_string()
    }
}
