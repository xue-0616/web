/// CKB address encoding/decoding utilities (bech32m, CKB2021 full format)
///
/// Full format: ckb1q<5-bit-format><code_hash><hash_type><args>
/// Short format: ckb1qz<short_id><args> (deprecated, for secp256k1-blake160 only)
///
/// Reference: https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0021-ckb-address-format/0021-ckb-address-format.md

const BECH32M_CONST: u32 = 0x2bc830a3;
const CHARSET: &[u8] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";

pub fn parse_ckb_address(address: &str) -> anyhow::Result<types::intent::CkbScript> {
    let (hrp, data) = bech32m_decode(address)?;
    if hrp != "ckb" && hrp != "ckt" {
        anyhow::bail!("Invalid CKB address HRP: {}", hrp);
    }
    if data.is_empty() {
        anyhow::bail!("Empty address payload");
    }

    let format_type = data[0];
    let payload = &data[1..];

    match format_type {
        0x00 => {
            // Full format: code_hash(32) + hash_type(1) + args(variable)
            if payload.len() < 33 {
                anyhow::bail!("Full format address payload too short: {}", payload.len());
            }
            let mut code_hash = [0u8; 32];
            code_hash.copy_from_slice(&payload[..32]);
            let hash_type = payload[32];
            let args = payload[33..].to_vec();
            Ok(types::intent::CkbScript { code_hash, hash_type, args })
        }
        0x01 => {
            // Short format (secp256k1-blake160): args = 20 bytes
            let code_hash = hex_to_bytes32(
                "9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
            );
            if payload.len() != 20 {
                anyhow::bail!("Short secp256k1 address must have 20-byte args, got {}", payload.len());
            }
            Ok(types::intent::CkbScript { code_hash, hash_type: 1, args: payload.to_vec() })
        }
        0x02 => {
            // Short format (multisig): args = 20 bytes
            let code_hash = hex_to_bytes32(
                "5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8",
            );
            if payload.len() != 20 {
                anyhow::bail!("Short multisig address must have 20-byte args, got {}", payload.len());
            }
            Ok(types::intent::CkbScript { code_hash, hash_type: 1, args: payload.to_vec() })
        }
        _ => anyhow::bail!("Unknown CKB address format type: 0x{:02x}", format_type),
    }
}

pub fn encode_ckb_address(lock: &types::intent::CkbScript, is_mainnet: bool) -> String {
    let hrp = if is_mainnet { "ckb" } else { "ckt" };
    // Full format (0x00)
    let mut payload = vec![0x00u8];
    payload.extend_from_slice(&lock.code_hash);
    payload.push(lock.hash_type);
    payload.extend_from_slice(&lock.args);
    bech32m_encode(hrp, &payload)
}

fn hex_to_bytes32(hex_str: &str) -> [u8; 32] {
    let bytes = hex::decode(hex_str).unwrap();
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    arr
}

fn bech32m_polymod(values: &[u8]) -> u32 {
    let mut chk: u32 = 1;
    for &v in values {
        let b = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ (v as u32);
        for i in 0..5 {
            chk ^= if (b >> i) & 1 == 1 {
                [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3][i]
            } else {
                0
            };
        }
    }
    chk
}

fn bech32m_hrp_expand(hrp: &str) -> Vec<u8> {
    let mut ret: Vec<u8> = hrp.bytes().map(|b| b >> 5).collect();
    ret.push(0);
    ret.extend(hrp.bytes().map(|b| b & 31));
    ret
}

fn bech32m_create_checksum(hrp: &str, data: &[u8]) -> Vec<u8> {
    let mut values = bech32m_hrp_expand(hrp);
    values.extend_from_slice(data);
    values.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
    let polymod = bech32m_polymod(&values) ^ BECH32M_CONST;
    (0..6).map(|i| ((polymod >> (5 * (5 - i))) & 31) as u8).collect()
}

fn bech32m_encode(hrp: &str, payload: &[u8]) -> String {
    let data = convert_bits(payload, 8, 5, true);
    let checksum = bech32m_create_checksum(hrp, &data);
    let mut result = format!("{}1", hrp);
    for &d in data.iter().chain(checksum.iter()) {
        result.push(CHARSET[d as usize] as char);
    }
    result
}

fn bech32m_decode(bech: &str) -> anyhow::Result<(String, Vec<u8>)> {
    let lower = bech.to_lowercase();
    let pos = lower.rfind('1').ok_or_else(|| anyhow::anyhow!("No separator '1' found"))?;
    let hrp = &lower[..pos];
    let data_part = &lower[pos + 1..];
    if data_part.len() < 6 {
        anyhow::bail!("Data part too short");
    }
    let mut data: Vec<u8> = Vec::new();
    for c in data_part.chars() {
        let idx = CHARSET.iter().position(|&ch| ch as char == c)
            .ok_or_else(|| anyhow::anyhow!("Invalid bech32 char: {}", c))?;
        data.push(idx as u8);
    }
    let mut values = bech32m_hrp_expand(hrp);
    values.extend_from_slice(&data);
    if bech32m_polymod(&values) != BECH32M_CONST {
        anyhow::bail!("Invalid bech32m checksum");
    }
    let data_no_checksum = &data[..data.len() - 6];
    let payload = convert_bits(data_no_checksum, 5, 8, false);
    Ok((hrp.to_string(), payload))
}

fn convert_bits(data: &[u8], from: u32, to: u32, pad: bool) -> Vec<u8> {
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    let mut ret = Vec::new();
    let maxv = (1u32 << to) - 1;
    for &value in data {
        acc = (acc << from) | (value as u32);
        bits += from;
        while bits >= to {
            bits -= to;
            ret.push(((acc >> bits) & maxv) as u8);
        }
    }
    if pad && bits > 0 {
        ret.push(((acc << (to - bits)) & maxv) as u8);
    }
    ret
}
