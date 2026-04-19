/// Convert bytes to hex string
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// Convert hex string to bytes
pub fn hex_to_bytes(hex_str: &str) -> Result<Vec<u8>, hex::FromHexError> {
    let cleaned = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    hex::decode(cleaned)
}

/// Convert bytes to H256 (32 bytes)
pub fn bytes_to_h256(bytes: &[u8]) -> Option<[u8; 32]> {
    if bytes.len() != 32 {
        return None;
    }
    let mut h256 = [0u8; 32];
    h256.copy_from_slice(bytes);
    Some(h256)
}

/// Blake2b-256 hash (CKB default hasher)
pub fn blake2b_256(data: &[u8]) -> [u8; 32] {
    let mut hasher = blake2b_rs::Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    hasher.update(data);
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);
    hash
}

/// Blake160 — first 20 bytes of blake2b-256
pub fn blake160(data: &[u8]) -> [u8; 20] {
    let hash = blake2b_256(data);
    let mut result = [0u8; 20];
    result.copy_from_slice(&hash[..20]);
    result
}

/// Calculate CKB script hash
pub fn script_hash(code_hash: &[u8; 32], hash_type: u8, args: &[u8]) -> [u8; 32] {
    // Molecule serialize: Script { code_hash, hash_type, args }
    // Then blake2b_256
    let mut buf = Vec::new();

    // Molecule table header
    let fields_count = 3u32;
    let header_size = 4 + fields_count * 4; // total_size + offsets
    let code_hash_size = 32u32;
    let hash_type_size = 1u32;
    let args_size = 4 + args.len() as u32; // fixvec: length + data

    let total_size = header_size + code_hash_size + hash_type_size + args_size;

    // total_size
    buf.extend_from_slice(&total_size.to_le_bytes());
    // offset to code_hash
    buf.extend_from_slice(&header_size.to_le_bytes());
    // offset to hash_type
    buf.extend_from_slice(&(header_size + code_hash_size).to_le_bytes());
    // offset to args
    buf.extend_from_slice(&(header_size + code_hash_size + hash_type_size).to_le_bytes());

    // code_hash
    buf.extend_from_slice(code_hash);
    // hash_type
    buf.push(hash_type);
    // args (fixvec)
    buf.extend_from_slice(&(args.len() as u32).to_le_bytes());
    buf.extend_from_slice(args);

    blake2b_256(&buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_roundtrip() {
        let bytes = vec![0xde, 0xad, 0xbe, 0xef];
        let hex = bytes_to_hex(&bytes);
        assert_eq!(hex, "deadbeef");
        let back = hex_to_bytes(&hex).unwrap();
        assert_eq!(back, bytes);
    }

    #[test]
    fn test_hex_with_0x_prefix() {
        let bytes = hex_to_bytes("0xdeadbeef").unwrap();
        assert_eq!(bytes, vec![0xde, 0xad, 0xbe, 0xef]);
    }
}
