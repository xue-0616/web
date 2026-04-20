// Parse ModuleGuest execute calldata into structured operations

use ethers::abi::{self, Token};
use ethers::types::{Address, Bytes, U256};
use anyhow::{Result, bail};

use crate::types::parsed_transaction::ParsedTransaction;

/// Parse ModuleMain.execute(bytes _txs, uint256 _nonce, bytes _signature) calldata
pub fn parse_execute_calldata(data: &[u8]) -> Result<ParsedTransaction> {
    // First 4 bytes = selector 0x1f6a1eb9 (execute)
    if data.len() < 4 {
        bail!("calldata too short");
    }
    let selector = &data[..4];
    if selector != [0x1f, 0x6a, 0x1e, 0xb9] {
        bail!("unknown selector: 0x{}", hex::encode(selector));
    }

    // Decode ABI: (bytes, uint256, bytes)
    let tokens = abi::decode(
        &[abi::ParamType::Bytes, abi::ParamType::Uint(256), abi::ParamType::Bytes],
        &data[4..],
    )?;

    let txs_bytes = match &tokens[0] {
        Token::Bytes(b) => b.clone(),
        _ => bail!("expected bytes for _txs"),
    };
    let nonce = match &tokens[1] {
        Token::Uint(n) => *n,
        _ => bail!("expected uint256 for _nonce"),
    };
    let signature = match &tokens[2] {
        Token::Bytes(b) => b.clone(),
        _ => bail!("expected bytes for _signature"),
    };

    // Parse inner transactions from _txs (packed encoding)
    let inner_txs = parse_inner_transactions(&txs_bytes)?;

    Ok(ParsedTransaction {
        nonce,
        signature: Bytes::from(signature),
        inner_txs,
    })
}

/// Inner transaction format: [delegateCall:1][revertOnError:1][gasLimit:32][target:20][value:32][dataLen:32][data:N]
#[derive(Debug, Clone)]
pub struct InnerTransaction {
    pub delegate_call: bool,
    pub revert_on_error: bool,
    pub gas_limit: U256,
    pub target: Address,
    pub value: U256,
    pub data: Bytes,
}

fn parse_inner_transactions(data: &[u8]) -> Result<Vec<InnerTransaction>> {
    let mut txs = Vec::new();
    let mut offset = 0;

    while offset < data.len() {
        if data.len() - offset < 86 {
            break; // minimum: 1+1+32+20+32 = 86 bytes header
        }
        let delegate_call = data[offset] != 0;
        let revert_on_error = data[offset + 1] != 0;
        offset += 2;

        let gas_limit = U256::from_big_endian(&data[offset..offset + 32]);
        offset += 32;

        let target = Address::from_slice(&data[offset..offset + 20]);
        offset += 20;

        let value = U256::from_big_endian(&data[offset..offset + 32]);
        offset += 32;

        if data.len() - offset < 32 {
            break;
        }
        let data_len_u256 = U256::from_big_endian(&data[offset..offset + 32]);
        offset += 32;

        // Guard against attacker-controlled huge `data_len`: U256::as_usize()
        // panics on overflow, which would DoS the relayer worker. Reject
        // anything that does not fit into the remaining buffer.
        if data_len_u256.bits() > 64 {
            bail!("inner tx data_len overflow");
        }
        let data_len: usize = data_len_u256
            .as_u64()
            .try_into()
            .map_err(|_| anyhow::anyhow!("inner tx data_len does not fit in usize"))?;

        if data.len() - offset < data_len {
            bail!("inner tx data truncated");
        }
        let tx_data = Bytes::from(data[offset..offset + data_len].to_vec());
        offset += data_len;

        txs.push(InnerTransaction {
            delegate_call,
            revert_on_error,
            gas_limit,
            target,
            value,
            data: tx_data,
        });
    }

    Ok(txs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::abi::{encode, Token};

    /// Build a well-formed execute calldata with `n` identical inner txs.
    /// The inner tx has: delegate_call=false, revert_on_error=true,
    /// gas_limit=100_000, target=0x00…01, value=0, data=empty.
    fn mk_calldata(n: usize, nonce: u64) -> Vec<u8> {
        let mut inner = Vec::new();
        for _ in 0..n {
            inner.push(0u8);
            inner.push(1u8);
            let mut gas = [0u8; 32];
            U256::from(100_000u64).to_big_endian(&mut gas);
            inner.extend_from_slice(&gas);
            let mut target = [0u8; 20];
            target[19] = 1;
            inner.extend_from_slice(&target);
            inner.extend_from_slice(&[0u8; 32]); // value
            inner.extend_from_slice(&[0u8; 32]); // data_len = 0
        }
        let encoded = encode(&[
            Token::Bytes(inner),
            Token::Uint(U256::from(nonce)),
            Token::Bytes(vec![0xaa; 65]),
        ]);
        let mut out = vec![0x1f, 0x6a, 0x1e, 0xb9];
        out.extend_from_slice(&encoded);
        out
    }

    #[test]
    fn parses_one_inner() {
        let cd = mk_calldata(1, 5);
        let p = parse_execute_calldata(&cd).expect("parse");
        assert_eq!(p.nonce, U256::from(5));
        assert_eq!(p.inner_txs.len(), 1);
        assert!(!p.inner_txs[0].delegate_call);
        assert!(p.inner_txs[0].revert_on_error);
        assert_eq!(p.inner_txs[0].gas_limit, U256::from(100_000u64));
    }

    #[test]
    fn parses_many_inner() {
        let cd = mk_calldata(5, 99);
        let p = parse_execute_calldata(&cd).unwrap();
        assert_eq!(p.inner_txs.len(), 5);
        assert_eq!(p.nonce, U256::from(99));
    }

    #[test]
    fn rejects_too_short() {
        let err = parse_execute_calldata(&[0x1f, 0x6a]).unwrap_err();
        assert!(err.to_string().contains("too short"));
    }

    #[test]
    fn rejects_bad_selector() {
        let mut cd = mk_calldata(1, 1);
        cd[0] = 0xde;
        cd[1] = 0xad;
        let err = parse_execute_calldata(&cd).unwrap_err();
        assert!(err.to_string().contains("unknown selector"));
    }

    /// A malicious `data_len` larger than u64 (bits > 64) must be
    /// rejected cleanly instead of panicking via `U256::as_usize`.
    #[test]
    fn rejects_overflow_data_len() {
        use ethers::abi::{encode, Token};
        let mut inner = Vec::new();
        inner.push(0u8);
        inner.push(1u8);
        let mut gas = [0u8; 32];
        U256::from(100_000u64).to_big_endian(&mut gas);
        inner.extend_from_slice(&gas);
        inner.extend_from_slice(&[0u8; 20]); // target
        inner.extend_from_slice(&[0u8; 32]); // value
        // data_len with top bits set → >64-bit → should be rejected.
        inner.extend_from_slice(&[0xff; 32]);
        let encoded = encode(&[
            Token::Bytes(inner),
            Token::Uint(U256::from(1u64)),
            Token::Bytes(vec![]),
        ]);
        let mut cd = vec![0x1f, 0x6a, 0x1e, 0xb9];
        cd.extend_from_slice(&encoded);

        let err = parse_execute_calldata(&cd).unwrap_err();
        assert!(err.to_string().contains("overflow"));
    }
}
