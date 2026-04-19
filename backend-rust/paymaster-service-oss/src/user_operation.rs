//! ERC-4337 v0.6 UserOperation type.
//!
//! The canonical struct (from eth-infinitism/account-abstraction v0.6.0):
//!
//! ```solidity
//! struct UserOperation {
//!     address sender;
//!     uint256 nonce;
//!     bytes   initCode;
//!     bytes   callData;
//!     uint256 callGasLimit;
//!     uint256 verificationGasLimit;
//!     uint256 preVerificationGas;
//!     uint256 maxFeePerGas;
//!     uint256 maxPriorityFeePerGas;
//!     bytes   paymasterAndData;
//!     bytes   signature;
//! }
//! ```
//!
//! The closed-source ELF uses this exact shape (confirmed by
//! `struct UserOperation with 11 elements` + the field order in its
//! .rodata serde dump).

use ethers_core::{
    abi::{encode, Token},
    types::{Address, Bytes, U256},
    utils::keccak256,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UserOperation {
    pub sender: Address,
    pub nonce: U256,
    pub init_code: Bytes,
    pub call_data: Bytes,
    pub call_gas_limit: U256,
    pub verification_gas_limit: U256,
    pub pre_verification_gas: U256,
    pub max_fee_per_gas: U256,
    pub max_priority_fee_per_gas: U256,
    pub paymaster_and_data: Bytes,
    pub signature: Bytes,
}

impl UserOperation {
    /// The hash the VerifyingPaymaster v0.6 contract computes in
    /// `getHash(userOp, validUntil, validAfter)`.
    ///
    /// Reference:
    /// <https://github.com/eth-infinitism/account-abstraction/blob/v0.6.0/contracts/samples/VerifyingPaymaster.sol>
    ///
    /// Exact logic (paraphrased):
    /// ```solidity
    /// keccak256(abi.encode(
    ///   sender, nonce,
    ///   keccak256(initCode),
    ///   keccak256(callData),
    ///   callGasLimit, verificationGasLimit, preVerificationGas,
    ///   maxFeePerGas, maxPriorityFeePerGas,
    ///   chainId, paymaster,
    ///   validUntil, validAfter
    /// ))
    /// ```
    ///
    /// **Note**: `paymasterAndData` and `signature` are NOT part of the
    /// hashed input — this is deliberate: the paymaster's signature must
    /// not commit to itself (circular), and the user's signature isn't
    /// available yet at sponsorship time.
    pub fn paymaster_hash(
        &self,
        chain_id: u64,
        paymaster_addr: Address,
        valid_until: u64,
        valid_after: u64,
    ) -> [u8; 32] {
        let encoded = encode(&[
            Token::Address(self.sender),
            Token::Uint(self.nonce),
            Token::FixedBytes(keccak256(&self.init_code).to_vec()),
            Token::FixedBytes(keccak256(&self.call_data).to_vec()),
            Token::Uint(self.call_gas_limit),
            Token::Uint(self.verification_gas_limit),
            Token::Uint(self.pre_verification_gas),
            Token::Uint(self.max_fee_per_gas),
            Token::Uint(self.max_priority_fee_per_gas),
            Token::Uint(U256::from(chain_id)),
            Token::Address(paymaster_addr),
            Token::Uint(U256::from(valid_until)),
            Token::Uint(U256::from(valid_after)),
        ]);
        keccak256(&encoded)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_op() -> UserOperation {
        UserOperation {
            sender: Address::repeat_byte(0xab),
            nonce: U256::from(42),
            init_code: Bytes::from_static(&[]),
            call_data: Bytes::from_static(&[0x01, 0x02, 0x03]),
            call_gas_limit: U256::from(100_000),
            verification_gas_limit: U256::from(100_000),
            pre_verification_gas: U256::from(21_000),
            max_fee_per_gas: U256::from(1_000_000_000u64),
            max_priority_fee_per_gas: U256::from(1_000_000_000u64),
            paymaster_and_data: Bytes::from_static(&[]),
            signature: Bytes::from_static(&[]),
        }
    }

    #[test]
    fn serialises_camelcase() {
        let op = sample_op();
        let json = serde_json::to_value(&op).unwrap();
        assert!(json.get("callGasLimit").is_some());
        assert!(json.get("initCode").is_some());
        assert!(json.get("paymasterAndData").is_some());
        // and NOT the snake-case variants
        assert!(json.get("call_gas_limit").is_none());
    }

    #[test]
    fn paymaster_hash_is_deterministic() {
        let op = sample_op();
        let pm = Address::repeat_byte(0xcd);
        let h1 = op.paymaster_hash(1, pm, 1_700_000_000, 0);
        let h2 = op.paymaster_hash(1, pm, 1_700_000_000, 0);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 32);
    }

    #[test]
    fn paymaster_hash_depends_on_chain_id() {
        let op = sample_op();
        let pm = Address::repeat_byte(0xcd);
        let h_eth = op.paymaster_hash(1, pm, 1_700_000_000, 0);
        let h_poly = op.paymaster_hash(137, pm, 1_700_000_000, 0);
        assert_ne!(h_eth, h_poly);
    }

    #[test]
    fn paymaster_hash_depends_on_valid_until() {
        let op = sample_op();
        let pm = Address::repeat_byte(0xcd);
        let h_a = op.paymaster_hash(1, pm, 100, 0);
        let h_b = op.paymaster_hash(1, pm, 200, 0);
        assert_ne!(h_a, h_b);
    }

    #[test]
    fn paymaster_hash_ignores_paymaster_and_data_and_signature() {
        // The hash MUST NOT depend on these two fields (see contract comment).
        let op = sample_op();
        let mut op_with_junk = op.clone();
        op_with_junk.paymaster_and_data = Bytes::from_static(&[0xff; 100]);
        op_with_junk.signature = Bytes::from_static(&[0xee; 65]);
        let pm = Address::repeat_byte(0xcd);
        let h_clean = op.paymaster_hash(1, pm, 100, 0);
        let h_junk = op_with_junk.paymaster_hash(1, pm, 100, 0);
        assert_eq!(h_clean, h_junk);
    }
}
