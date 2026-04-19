//! secp256k1 signature verification for privileged intents.
//!
//! Signature format: 65-byte compact recoverable signature
//!   `r[32] || s[32] || v[1]` where `v ∈ {0, 1, 27, 28}`.
//! Message is hashed with SHA-256 before ECDSA recovery (caller passes the
//! already-hashed digest).  If the recovered public key matches one of the
//! operator-configured pubkeys the signature is accepted.
//!
//! Why SHA-256 (and not CKB-native Blake2b)?
//! CKB tooling (e.g. `ckb-cli sign-message`) emits both; SHA-256 is available
//! in the stdlib of every client SDK, so clients can sign in the browser with
//! a handful of lines.  Operators who standardise on Blake2b should swap the
//! `hash_payload` impl.

use k256::ecdsa::{RecoveryId, Signature as EcdsaSignature, VerifyingKey};
use sha2::{Digest, Sha256};

/// Build the canonical payload for a create-pool intent.
///
/// Format: `"create-pool|<creator>|<lp_hash>|<reward_hash>|<reward_per_sec>|<start>|<end>"`.
/// The literal prefix acts as a domain separator to prevent signatures created
/// for one action being replayed against another.
pub fn create_pool_canonical_payload(
    creator_address: &str,
    lp_token_type_hash: &str,
    reward_token_type_hash: &str,
    reward_per_second: &str,
    start_time: u64,
    end_time: u64,
) -> String {
    format!(
        "create-pool|{}|{}|{}|{}|{}|{}",
        creator_address,
        lp_token_type_hash,
        reward_token_type_hash,
        reward_per_second,
        start_time,
        end_time,
    )
}

/// SHA-256 of the payload bytes.
pub fn hash_payload(payload: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    hasher.finalize().into()
}

/// Parse a hex-encoded 65-byte compact recoverable signature.
fn parse_compact_recoverable(sig_hex: &str) -> Result<(EcdsaSignature, RecoveryId), String> {
    let trimmed = sig_hex.trim_start_matches("0x").trim_start_matches("0X");
    let bytes = hex::decode(trimmed).map_err(|e| format!("invalid hex: {}", e))?;
    if bytes.len() != 65 {
        return Err(format!("expected 65-byte signature, got {}", bytes.len()));
    }
    let mut rs = [0u8; 64];
    rs.copy_from_slice(&bytes[..64]);
    let sig = EcdsaSignature::from_slice(&rs).map_err(|e| format!("invalid r||s: {}", e))?;
    // Normalise Ethereum-style v (27/28) to 0/1.
    let v_raw = bytes[64];
    let v = match v_raw {
        0 | 1 => v_raw,
        27 | 28 => v_raw - 27,
        _ => return Err(format!("invalid v byte: {}", v_raw)),
    };
    let rid = RecoveryId::try_from(v).map_err(|e| format!("invalid recovery id: {}", e))?;
    Ok((sig, rid))
}

/// Parse a hex-encoded secp256k1 public key (compressed 33B or uncompressed 65B).
fn parse_pubkey(pubkey_hex: &str) -> Result<VerifyingKey, String> {
    let trimmed = pubkey_hex.trim_start_matches("0x").trim_start_matches("0X");
    let bytes = hex::decode(trimmed).map_err(|e| format!("invalid hex: {}", e))?;
    VerifyingKey::from_sec1_bytes(&bytes).map_err(|e| format!("invalid pubkey: {}", e))
}

/// Verify the signature recovers a public key that matches one of
/// `allowed_pubkeys_hex`.  Returns `Ok(())` on success.
pub fn verify_signature(
    digest: &[u8; 32],
    signature_hex: &str,
    allowed_pubkeys_hex: &[String],
) -> Result<(), String> {
    if allowed_pubkeys_hex.is_empty() {
        return Err("no admin pubkeys configured — set FARM_ADMIN_PUBKEYS".to_string());
    }
    let (sig, rid) = parse_compact_recoverable(signature_hex)?;
    let recovered = VerifyingKey::recover_from_prehash(digest, &sig, rid)
        .map_err(|e| format!("signature recovery failed: {}", e))?;
    let recovered_sec1 = recovered.to_sec1_bytes();
    for allowed in allowed_pubkeys_hex {
        if let Ok(allowed_key) = parse_pubkey(allowed) {
            let allowed_sec1 = allowed_key.to_sec1_bytes();
            if allowed_sec1 == recovered_sec1 {
                return Ok(());
            }
        }
    }
    Err("recovered pubkey does not match any admin".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_payload_is_deterministic() {
        let a = create_pool_canonical_payload("addr", "0xaa", "0xbb", "100", 1, 2);
        let b = create_pool_canonical_payload("addr", "0xaa", "0xbb", "100", 1, 2);
        assert_eq!(a, b);
        assert!(a.starts_with("create-pool|"));
    }

    #[test]
    fn rejects_when_no_admin_pubkeys_configured() {
        let empty: Vec<String> = vec![];
        assert!(verify_signature(&[0u8; 32], &"00".repeat(65), &empty).is_err());
    }

    #[test]
    fn rejects_malformed_signature() {
        assert!(verify_signature(&[0u8; 32], "not-hex", &["02aabbcc".to_string()]).is_err());
        // Wrong length.
        assert!(verify_signature(&[0u8; 32], &"00".repeat(10), &["02aabbcc".to_string()]).is_err());
    }
}
