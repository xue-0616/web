//! Structural validation of a parsed ModuleMain.execute meta-transaction.
//!
//! **BUG-P2-C2** fix (part 1): before the relayer submits a meta-tx on behalf
//! of a user, we enforce the structural invariants that the on-chain wallet
//! would check anyway (plus a couple of relayer-specific DoS / fund-drain
//! guards). These checks are **cheap, local, and deterministic** — they must
//! pass before we even dial the RPC for the authoritative `isValidSignature`
//! simulation. They exist to reject obvious abuse at the edge.
//!
//! What this module does **not** do:
//!   * cryptographic signature verification (delegated to the on-chain wallet
//!     via `ContractSimulator`),
//!   * replay protection (handled in the relayer's Redis nonce cache),
//!   * gas / fee sanity (handled at broadcast time).

use ethers::types::U256;

use crate::execute_parser::InnerTransaction;
use crate::types::parsed_transaction::ParsedTransaction;

/// Maximum number of inner transactions we will accept in one meta-tx.
/// HIGH-RL-2 in the deep audit: without a cap an attacker can submit
/// calldata with millions of inner tx headers and the parser will loop
/// until OOM. 32 is generous for any legitimate UniPass wallet action
/// (typical batches are 1–4 inner txs).
pub const MAX_INNER_TXS: usize = 32;

/// Maximum total `value` summed across inner txs, denominated in wei.
/// This is a belt-and-braces check: the wallet contract is authoritative,
/// but a runaway value field is a cheap signal of malformed calldata.
/// 2^128 wei = 3.4e20 ETH; anything above that is certainly bogus.
pub const MAX_CUMULATIVE_VALUE_BITS: usize = 128;

/// Maximum inner tx `gasLimit`. Individual inner txs that claim more than
/// the per-block gas limit cannot possibly be executed; rejecting them
/// early saves an RPC round-trip. 30M is today's Arbitrum / Ethereum
/// block gas limit; we use 2x as a safety margin.
pub const MAX_INNER_GAS: u64 = 60_000_000;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ValidationError {
    #[error("inner tx count {0} exceeds maximum of {max}", max = MAX_INNER_TXS)]
    TooManyInnerTxs(usize),

    #[error(
        "inner tx #{idx} requests delegate_call=true; disallowed to prevent \
         wallet fund drain via malicious logic contracts (HIGH-RL-3)"
    )]
    DelegateCallForbidden { idx: usize },

    #[error("inner tx #{idx} gas_limit {gas} exceeds {max}", max = MAX_INNER_GAS)]
    GasLimitTooHigh { idx: usize, gas: u64 },

    #[error("cumulative value overflows {MAX_CUMULATIVE_VALUE_BITS}-bit field")]
    ValueOverflow,

    #[error("calldata carries no inner transactions (nothing to relay)")]
    NoInnerTxs,
}

/// Run every purely-local check required of a meta-tx before it may be
/// submitted for on-chain simulation. Returns `Ok(())` iff the parsed
/// transaction is safe to hand to `ContractSimulator::simulate`.
pub fn validate_structural(tx: &ParsedTransaction) -> Result<(), ValidationError> {
    if tx.inner_txs.is_empty() {
        return Err(ValidationError::NoInnerTxs);
    }
    if tx.inner_txs.len() > MAX_INNER_TXS {
        return Err(ValidationError::TooManyInnerTxs(tx.inner_txs.len()));
    }

    let mut cumulative = U256::zero();
    for (idx, inner) in tx.inner_txs.iter().enumerate() {
        check_inner(idx, inner)?;

        cumulative = cumulative
            .checked_add(inner.value)
            .ok_or(ValidationError::ValueOverflow)?;
    }

    if cumulative.bits() > MAX_CUMULATIVE_VALUE_BITS {
        return Err(ValidationError::ValueOverflow);
    }

    Ok(())
}

fn check_inner(idx: usize, inner: &InnerTransaction) -> Result<(), ValidationError> {
    if inner.delegate_call {
        return Err(ValidationError::DelegateCallForbidden { idx });
    }
    // Guard the conversion: `as_u64()` panics on overflow. Anything
    // requesting > u64 gas is nonsense.
    if inner.gas_limit.bits() > 64 {
        return Err(ValidationError::GasLimitTooHigh {
            idx,
            gas: u64::MAX,
        });
    }
    let gas = inner.gas_limit.as_u64();
    if gas > MAX_INNER_GAS {
        return Err(ValidationError::GasLimitTooHigh { idx, gas });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::{Address, Bytes};

    fn bench_tx(count: usize) -> ParsedTransaction {
        let inner = (0..count)
            .map(|_| InnerTransaction {
                delegate_call: false,
                revert_on_error: true,
                gas_limit: U256::from(100_000),
                target: Address::zero(),
                value: U256::from(1),
                data: Bytes::new(),
            })
            .collect();
        ParsedTransaction {
            nonce: U256::from(1),
            signature: Bytes::new(),
            inner_txs: inner,
        }
    }

    #[test]
    fn happy_path() {
        assert_eq!(validate_structural(&bench_tx(3)), Ok(()));
    }

    #[test]
    fn rejects_empty() {
        assert_eq!(validate_structural(&bench_tx(0)), Err(ValidationError::NoInnerTxs));
    }

    #[test]
    fn rejects_over_cap() {
        assert_eq!(
            validate_structural(&bench_tx(MAX_INNER_TXS + 1)),
            Err(ValidationError::TooManyInnerTxs(MAX_INNER_TXS + 1)),
        );
    }

    #[test]
    fn accepts_exactly_cap() {
        assert_eq!(validate_structural(&bench_tx(MAX_INNER_TXS)), Ok(()));
    }

    #[test]
    fn rejects_delegate_call() {
        let mut tx = bench_tx(2);
        tx.inner_txs[1].delegate_call = true;
        assert_eq!(
            validate_structural(&tx),
            Err(ValidationError::DelegateCallForbidden { idx: 1 }),
        );
    }

    #[test]
    fn rejects_oversized_gas() {
        let mut tx = bench_tx(1);
        tx.inner_txs[0].gas_limit = U256::from(MAX_INNER_GAS + 1);
        assert_eq!(
            validate_structural(&tx),
            Err(ValidationError::GasLimitTooHigh {
                idx: 0,
                gas: MAX_INNER_GAS + 1,
            }),
        );
    }

    #[test]
    fn rejects_u256_overflow_gas() {
        let mut tx = bench_tx(1);
        tx.inner_txs[0].gas_limit = U256::MAX;
        assert!(matches!(
            validate_structural(&tx),
            Err(ValidationError::GasLimitTooHigh { idx: 0, .. })
        ));
    }

    #[test]
    fn rejects_cumulative_value_overflow() {
        let mut tx = bench_tx(2);
        tx.inner_txs[0].value = U256::from(1) << 127;
        tx.inner_txs[1].value = U256::from(1) << 127; // sum = 2^128 → overflows 128-bit field
        assert_eq!(validate_structural(&tx), Err(ValidationError::ValueOverflow));
    }

    #[test]
    fn accepts_large_but_reasonable_value() {
        let mut tx = bench_tx(1);
        tx.inner_txs[0].value = U256::from(1_000_000_000_000_000_000_u64); // 1 ETH
        assert_eq!(validate_structural(&tx), Ok(()));
    }
}
