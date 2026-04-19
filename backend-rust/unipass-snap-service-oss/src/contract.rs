//! Free-quota contract helpers.
//!
//! The free-quota contract verifies ECDSA signatures produced by this
//! service — the wallet splices `free_sig` into its transaction and the
//! contract recovers the signer, compares to a stored `freeQuotaSigner`.
//!
//! The signed digest is:
//!
//! ```text
//!   keccak256(abi.encode(
//!     contract_address, chain_id, wallet, nonce,
//!     used_free_quota, effective_time_unix
//!   ))
//! ```
//!
//! wrapped in the Ethereum signed-message prefix before ecrecover.
//!
//! **TODO(oss)**: confirm the exact ABI layout by comparing against the
//! on-chain `SnapContract` implementation when source is available.

use std::{sync::Arc, time::SystemTime};

use ethers_core::{
    abi::{encode, Token},
    types::{Address, Signature, U256},
    utils::{hash_message, keccak256},
};
use ethers_signers::{LocalWallet, Signer};

use crate::error::Error;

pub struct FreeQuotaSigner {
    signer: LocalWallet,
    contract_addresses: Arc<std::collections::HashMap<u64, Address>>,
}

impl FreeQuotaSigner {
    pub fn new(
        hex_priv_key: &str,
        contract_addresses: std::collections::HashMap<u64, Address>,
    ) -> Result<Self, Error> {
        let s = hex_priv_key.strip_prefix("0x").unwrap_or(hex_priv_key);
        let signer: LocalWallet = s.parse()
            .map_err(|e: ethers_signers::WalletError| Error::Internal(format!("signer: {e}")))?;
        Ok(Self {
            signer,
            contract_addresses: Arc::new(contract_addresses),
        })
    }

    pub fn signer_address(&self) -> Address {
        self.signer.address()
    }

    /// Produce a free-quota signature for the given tx parameters.
    /// Returns the 65-byte signature (r || s || v).
    pub async fn sign_free_quota(
        &self,
        chain_id: u64,
        wallet: Address,
        nonce: u64,
        used_free_quota: u32,
        effective_time_unix: u64,
    ) -> Result<Vec<u8>, Error> {
        let contract = *self
            .contract_addresses
            .get(&chain_id)
            .ok_or_else(|| Error::BadRequest(format!("unsupported chain {chain_id}")))?;
        let encoded = encode(&[
            Token::Address(contract),
            Token::Uint(U256::from(chain_id)),
            Token::Address(wallet),
            Token::Uint(U256::from(nonce)),
            Token::Uint(U256::from(used_free_quota)),
            Token::Uint(U256::from(effective_time_unix)),
        ]);
        let hash = keccak256(&encoded);
        let digest = hash_message(hash);
        let sig: Signature = self
            .signer
            .sign_hash(digest)
            .map_err(|e| Error::Internal(format!("sign: {e}")))?;
        Ok(sig.to_vec())
    }

    pub fn supported_chains(&self) -> Vec<u64> {
        let mut v: Vec<u64> = self.contract_addresses.keys().copied().collect();
        v.sort_unstable();
        v
    }
}

pub fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn mk_signer() -> FreeQuotaSigner {
        let mut m = HashMap::new();
        m.insert(1u64, Address::repeat_byte(0xEE));
        m.insert(137u64, Address::repeat_byte(0xEF));
        FreeQuotaSigner::new(
            "0x1111111111111111111111111111111111111111111111111111111111111111",
            m,
        ).unwrap()
    }

    #[tokio::test]
    async fn sign_rejects_unsupported_chain() {
        let s = mk_signer();
        let w = Address::repeat_byte(0xab);
        let r = s.sign_free_quota(999, w, 0, 0, 0).await;
        assert!(matches!(r, Err(Error::BadRequest(_))));
    }

    #[tokio::test]
    async fn sign_yields_65_byte_signature() {
        let s = mk_signer();
        let w = Address::repeat_byte(0xab);
        let sig = s.sign_free_quota(1, w, 1, 100, 1_700_000_000).await.unwrap();
        assert_eq!(sig.len(), 65);
    }

    #[tokio::test]
    async fn sign_depends_on_chain_id() {
        let s = mk_signer();
        let w = Address::repeat_byte(0xab);
        let sig1 = s.sign_free_quota(1, w, 1, 100, 1_700_000_000).await.unwrap();
        let sig2 = s.sign_free_quota(137, w, 1, 100, 1_700_000_000).await.unwrap();
        assert_ne!(sig1, sig2);
    }

    #[tokio::test]
    async fn sign_depends_on_nonce() {
        let s = mk_signer();
        let w = Address::repeat_byte(0xab);
        let sig1 = s.sign_free_quota(1, w, 1, 100, 1_700_000_000).await.unwrap();
        let sig2 = s.sign_free_quota(1, w, 2, 100, 1_700_000_000).await.unwrap();
        assert_ne!(sig1, sig2);
    }

    #[test]
    fn signer_address_deterministic() {
        let a1 = mk_signer().signer_address();
        let a2 = mk_signer().signer_address();
        assert_eq!(a1, a2);
    }

    #[test]
    fn supported_chains_sorted() {
        assert_eq!(mk_signer().supported_chains(), vec![1, 137]);
    }
}
