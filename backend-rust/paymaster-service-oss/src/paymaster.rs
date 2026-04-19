//! VerifyingPaymaster off-chain signer.
//!
//! Exposes [`Paymaster::sponsor`]: given a UserOperation + chain + validity
//! window, produce the `paymasterAndData` blob the user splices into their
//! op. The on-chain VerifyingPaymaster contract recovers the signer from
//! the signature and compares to a stored `verifyingSigner`.

use std::{
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use ethers_core::{
    abi::{encode, Token},
    types::{Address, Bytes, Signature, U256},
    utils::hash_message,
};
use ethers_signers::{LocalWallet, Signer};

use crate::{
    config::Config,
    user_operation::UserOperation,
};

#[derive(Debug, thiserror::Error)]
pub enum PaymasterError {
    #[error("chain {0} is not supported by this paymaster")]
    UnsupportedChain(u64),
    #[error("sender {0:?} is not allowed")]
    SenderNotAllowed(Address),
    #[error("invalid signer key: {0}")]
    InvalidSignerKey(String),
    #[error("sign: {0}")]
    Sign(String),
}

pub struct Paymaster {
    config: Arc<Config>,
    signer: LocalWallet,
}

impl Paymaster {
    pub fn new(config: Arc<Config>) -> Result<Self, PaymasterError> {
        let s = config
            .signer_private_key
            .strip_prefix("0x")
            .unwrap_or(&config.signer_private_key);
        let signer: LocalWallet = s
            .parse()
            .map_err(|e: ethers_signers::WalletError| PaymasterError::InvalidSignerKey(e.to_string()))?;
        Ok(Self { config, signer })
    }

    /// The EOA address the signer produces — must match `verifyingSigner`
    /// on the paymaster contract for signatures to be accepted.
    pub fn signer_address(&self) -> Address {
        self.signer.address()
    }

    /// Sponsor a UserOperation on `chain_id`, returning the
    /// `paymasterAndData` byte string the user must set in their op
    /// before presenting it to the EntryPoint.
    pub async fn sponsor(
        &self,
        op: &UserOperation,
        chain_id: u64,
    ) -> Result<SponsorResponse, PaymasterError> {
        let chain = self
            .config
            .chains
            .get(&chain_id)
            .ok_or(PaymasterError::UnsupportedChain(chain_id))?;

        if !self.config.is_allowed(&op.sender) {
            return Err(PaymasterError::SenderNotAllowed(op.sender));
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let valid_until: u64 = now + self.config.validity_window_secs;
        // valid_after = 0 means "valid immediately". Production paymasters
        // often set this to `now` for extra safety; for compat we keep 0.
        let valid_after: u64 = 0;

        let hash = op.paymaster_hash(chain_id, chain.paymaster_address, valid_until, valid_after);
        // The VerifyingPaymaster contract applies the Ethereum
        // "\x19Ethereum Signed Message\n32" prefix before ecrecover, so we
        // sign the prefixed digest.
        let eth_digest = hash_message(hash);
        let sig: Signature = self
            .signer
            .sign_hash(eth_digest)
            .map_err(|e| PaymasterError::Sign(e.to_string()))?;

        // paymasterAndData layout (canonical v0.6 VerifyingPaymaster):
        //   [0..20)   paymaster contract address
        //   [20..84)  abi.encode(uint48 validUntil, uint48 validAfter)  (2 × 32 bytes)
        //   [84..)    signature bytes (65)
        let mut pad = Vec::with_capacity(20 + 64 + 65);
        pad.extend_from_slice(chain.paymaster_address.as_bytes());
        let abi_part = encode(&[
            Token::Uint(U256::from(valid_until)),
            Token::Uint(U256::from(valid_after)),
        ]);
        pad.extend_from_slice(&abi_part);
        pad.extend_from_slice(&sig.to_vec());

        Ok(SponsorResponse {
            paymaster_and_data: Bytes::from(pad),
            pre_verification_gas: op.pre_verification_gas,
            verification_gas_limit: op.verification_gas_limit,
            call_gas_limit: op.call_gas_limit,
            valid_until,
            valid_after,
        })
    }

    pub fn entry_point_for(&self, chain_id: u64) -> Option<Address> {
        self.config.chains.get(&chain_id).map(|c| c.entry_point)
    }

    pub fn supported_chain_ids(&self) -> Vec<u64> {
        let mut ids: Vec<u64> = self.config.chains.keys().copied().collect();
        ids.sort_unstable();
        ids
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SponsorResponse {
    pub paymaster_and_data: Bytes,
    pub pre_verification_gas: U256,
    pub verification_gas_limit: U256,
    pub call_gas_limit: U256,
    /// Unix-seconds timestamp after which the signature is no longer valid.
    pub valid_until: u64,
    /// Unix-seconds timestamp before which the signature is not yet valid.
    pub valid_after: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ChainConfig;
    use std::collections::HashMap;

    fn mk_config() -> Config {
        let mut chains = HashMap::new();
        chains.insert(
            1u64,
            ChainConfig {
                paymaster_address: Address::repeat_byte(0x01),
                entry_point: Address::repeat_byte(0xEE),
                rpc_url: None,
            },
        );
        Config {
            bind: "0.0.0.0:0".into(),
            signer_private_key: "0x1111111111111111111111111111111111111111111111111111111111111111".into(),
            chains,
            whitelist: vec![],
            validity_window_secs: 600,
        }
    }

    fn sample_op(sender: Address) -> UserOperation {
        UserOperation {
            sender,
            nonce: U256::from(1),
            init_code: Bytes::from_static(&[]),
            call_data: Bytes::from_static(&[0xde, 0xad]),
            call_gas_limit: U256::from(100_000),
            verification_gas_limit: U256::from(100_000),
            pre_verification_gas: U256::from(21_000),
            max_fee_per_gas: U256::from(1_000_000_000u64),
            max_priority_fee_per_gas: U256::from(1_000_000_000u64),
            paymaster_and_data: Bytes::from_static(&[]),
            signature: Bytes::from_static(&[]),
        }
    }

    #[tokio::test]
    async fn sponsors_successfully_when_allowed() {
        let cfg = Arc::new(mk_config());
        let pm = Paymaster::new(cfg).unwrap();
        let op = sample_op(Address::repeat_byte(0xab));
        let out = pm.sponsor(&op, 1).await.unwrap();
        // paymasterAndData = 20 (address) + 64 (2×uint) + 65 (sig) = 149 bytes
        assert_eq!(out.paymaster_and_data.len(), 20 + 64 + 65);
        // First 20 bytes must equal the paymaster contract address
        assert_eq!(&out.paymaster_and_data[..20], [0x01u8; 20].as_slice());
        // Validity window reflects config
        assert!(out.valid_until > out.valid_after);
        assert_eq!(out.valid_after, 0);
    }

    #[tokio::test]
    async fn rejects_unsupported_chain() {
        let cfg = Arc::new(mk_config());
        let pm = Paymaster::new(cfg).unwrap();
        let op = sample_op(Address::repeat_byte(0xab));
        let err = pm.sponsor(&op, 999).await.unwrap_err();
        assert!(matches!(err, PaymasterError::UnsupportedChain(999)));
    }

    #[tokio::test]
    async fn rejects_non_whitelisted_sender_when_whitelist_set() {
        let mut cfg = mk_config();
        cfg.whitelist = vec![Address::repeat_byte(0xaa)];
        let pm = Paymaster::new(Arc::new(cfg)).unwrap();
        let op = sample_op(Address::repeat_byte(0xbb));
        let err = pm.sponsor(&op, 1).await.unwrap_err();
        assert!(matches!(err, PaymasterError::SenderNotAllowed(_)));
    }

    #[tokio::test]
    async fn allows_whitelisted_sender() {
        let sender = Address::repeat_byte(0xaa);
        let mut cfg = mk_config();
        cfg.whitelist = vec![sender];
        let pm = Paymaster::new(Arc::new(cfg)).unwrap();
        let op = sample_op(sender);
        pm.sponsor(&op, 1).await.unwrap();
    }

    #[tokio::test]
    async fn supported_chain_ids_is_sorted() {
        let mut cfg = mk_config();
        cfg.chains.insert(
            137,
            ChainConfig {
                paymaster_address: Address::repeat_byte(0x02),
                entry_point: Address::repeat_byte(0xEE),
                rpc_url: None,
            },
        );
        cfg.chains.insert(
            10,
            ChainConfig {
                paymaster_address: Address::repeat_byte(0x03),
                entry_point: Address::repeat_byte(0xEE),
                rpc_url: None,
            },
        );
        let pm = Paymaster::new(Arc::new(cfg)).unwrap();
        assert_eq!(pm.supported_chain_ids(), vec![1, 10, 137]);
    }

    #[test]
    fn signer_address_is_deterministic() {
        let cfg = Arc::new(mk_config());
        let pm = Paymaster::new(cfg.clone()).unwrap();
        let a1 = pm.signer_address();
        let pm2 = Paymaster::new(cfg).unwrap();
        let a2 = pm2.signer_address();
        assert_eq!(a1, a2);
    }

    #[test]
    fn invalid_signer_key_rejected_at_construction() {
        let mut cfg = mk_config();
        cfg.signer_private_key = "0xdeadbeef".into();
        let result = Paymaster::new(Arc::new(cfg));
        assert!(matches!(result, Err(PaymasterError::InvalidSignerKey(_))));
    }
}
