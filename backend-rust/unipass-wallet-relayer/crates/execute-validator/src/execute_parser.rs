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
