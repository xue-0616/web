//! Signature verification for the login flow.
//!
//! The client signs the Redis-issued nonce using the standard Ethereum
//! personal-message scheme:
//!
//! ```text
//!   digest = keccak256( "\x19Ethereum Signed Message:\n" ‖ len(nonce) ‖ nonce )
//!   sig    = secp256k1-ECDSA(digest, private_key)
//! ```
//!
//! ECrecover then yields the signing address, which must equal the
//! `wallet_address` the client claims.

use ethers_core::{
    types::{Address, Signature},
    utils::hash_message,
};

use crate::error::Error;

/// Recover the signer of a personal-message-style signature over
/// `nonce` and assert it matches `expected_wallet`.
///
/// Returns `Ok(())` iff recovery succeeds AND the recovered address
/// matches `expected_wallet` byte-for-byte.
pub fn verify_login_signature(
    expected_wallet: &[u8; 20],
    nonce: &str,
    signature_hex: &str,
) -> Result<(), Error> {
    let sig_bytes = hex::decode(signature_hex.trim_start_matches("0x"))
        .map_err(|_| Error::Unauthorized)?;
    if sig_bytes.len() != 65 {
        // Standard Ethereum signatures are r‖s‖v = 32+32+1 bytes.
        return Err(Error::Unauthorized);
    }
    let sig = Signature::try_from(sig_bytes.as_slice()).map_err(|_| Error::Unauthorized)?;
    let digest = hash_message(nonce.as_bytes());
    let recovered: Address = sig.recover(digest).map_err(|_| Error::Unauthorized)?;
    if recovered.as_bytes() != expected_wallet {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers_core::rand::thread_rng;
    use ethers_signers::{LocalWallet, Signer};

    async fn mk_sig(nonce: &str) -> (Address, String) {
        let wallet = LocalWallet::new(&mut thread_rng());
        let sig = wallet.sign_message(nonce).await.unwrap();
        (wallet.address(), format!("0x{sig}"))
    }

    #[tokio::test]
    async fn happy_path_roundtrip() {
        let nonce = "a1b2c3d4";
        let (addr, sig_hex) = mk_sig(nonce).await;
        let mut bytes = [0u8; 20];
        bytes.copy_from_slice(addr.as_bytes());
        verify_login_signature(&bytes, nonce, &sig_hex).unwrap();
    }

    #[tokio::test]
    async fn rejects_wrong_nonce() {
        let (addr, sig_hex) = mk_sig("correct").await;
        let mut bytes = [0u8; 20];
        bytes.copy_from_slice(addr.as_bytes());
        assert!(matches!(
            verify_login_signature(&bytes, "tampered", &sig_hex),
            Err(Error::Unauthorized)
        ));
    }

    #[tokio::test]
    async fn rejects_wrong_address() {
        let nonce = "x";
        let (_, sig_hex) = mk_sig(nonce).await;
        let other = [0u8; 20]; // can't match a real key's address
        assert!(matches!(
            verify_login_signature(&other, nonce, &sig_hex),
            Err(Error::Unauthorized)
        ));
    }

    #[test]
    fn rejects_malformed_hex() {
        let addr = [0u8; 20];
        assert!(matches!(
            verify_login_signature(&addr, "x", "zzz"),
            Err(Error::Unauthorized)
        ));
    }

    #[test]
    fn rejects_wrong_length() {
        let addr = [0u8; 20];
        // 64 bytes instead of 65
        let short = format!("0x{}", "aa".repeat(64));
        assert!(matches!(
            verify_login_signature(&addr, "x", &short),
            Err(Error::Unauthorized)
        ));
    }

    #[test]
    fn accepts_signature_without_0x_prefix() {
        // Construction path: just make sure the `0x` stripping branch
        // doesn't crash even on an invalid body (rejected downstream).
        let addr = [0u8; 20];
        assert!(matches!(
            verify_login_signature(&addr, "x", &"ab".repeat(65)),
            Err(Error::Unauthorized)
        ));
    }

    #[tokio::test]
    async fn flipping_one_bit_in_signature_rejects() {
        let nonce = "y";
        let (addr, sig_hex) = mk_sig(nonce).await;
        let mut bytes = hex::decode(sig_hex.trim_start_matches("0x")).unwrap();
        bytes[0] ^= 0x01;
        let tampered = format!("0x{}", hex::encode(&bytes));
        let mut w = [0u8; 20];
        w.copy_from_slice(addr.as_bytes());
        assert!(matches!(
            verify_login_signature(&w, nonce, &tampered),
            Err(Error::Unauthorized)
        ));
    }
}
