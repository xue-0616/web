use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// HMAC-SHA256 signing for webhook verification
pub fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

/// Verify HMAC-SHA256 signature
pub fn verify_hmac_sha256(key: &[u8], data: &[u8], signature: &[u8]) -> bool {
    let computed = hmac_sha256(key, data);
    constant_time_eq(&computed, signature)
}

/// Constant-time byte comparison used to verify HMAC signatures.
///
/// CRIT-RL-1 (defense in depth): although an HMAC-SHA256 output is
/// always 32 bytes and the length is therefore not itself secret,
/// we still iterate `max(a.len, b.len)` rather than early-returning
/// on length mismatch. Keeping the three cross-service implementations
/// uniform makes it harder for a future maintainer to pattern-match
/// on one and reintroduce the early-return in another. Threat model
/// is detailed in backend-rust/unipass-wallet-relayer/src/security.rs.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    let max_len = a.len().max(b.len());
    let mut diff: u8 = 0;
    for i in 0..max_len {
        let ai = if i < a.len() { a[i] } else { 0 };
        let bi = if i < b.len() { b[i] } else { 0 };
        diff |= ai ^ bi;
    }
    let bytes_eq = (diff == 0) as u8;
    let len_eq = (a.len() == b.len()) as u8;
    (bytes_eq & len_eq) == 1
}

#[cfg(test)]
mod tests {
    //! Regression tests for the HMAC verification path, covering
    //! both the happy case and the three length-edge cases that
    //! caught the relayer out before CRIT-RL-1 was fixed.
    use super::*;

    #[test]
    fn verify_hmac_accepts_correct_signature() {
        let key = b"s3cret-webhook-key";
        let data = b"payment.completed:order-42";
        let sig = hmac_sha256(key, data);
        assert!(verify_hmac_sha256(key, data, &sig));
    }

    #[test]
    fn verify_hmac_rejects_tampered_last_byte() {
        let key = b"s3cret-webhook-key";
        let data = b"payment.completed:order-42";
        let mut sig = hmac_sha256(key, data);
        let last = sig.last_mut().unwrap();
        *last ^= 0x01;
        assert!(!verify_hmac_sha256(key, data, &sig));
    }

    #[test]
    fn verify_hmac_rejects_short_signature() {
        // A 31-byte signature must fail cleanly, not via early
        // return — the CRIT-RL-1 fix iterates max_len regardless.
        let key = b"s3cret-webhook-key";
        let data = b"x";
        let sig = hmac_sha256(key, data);
        assert!(!verify_hmac_sha256(key, data, &sig[..31]));
    }

    #[test]
    fn verify_hmac_rejects_oversized_signature() {
        // 64 bytes (the attacker tacked on 32 more) must also fail.
        let key = b"s3cret-webhook-key";
        let data = b"x";
        let mut sig = hmac_sha256(key, data);
        sig.extend_from_slice(&[0u8; 32]);
        assert!(!verify_hmac_sha256(key, data, &sig));
    }
}
