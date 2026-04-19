use blake2b_rs::Blake2bBuilder;

/// Compute pool type hash from asset X and asset Y type hashes
/// Uses CKB blake2b with "ckb-default-hash" personalization
pub fn compute_pool_type_hash(asset_x_hash: &[u8; 32], asset_y_hash: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    // Ensure deterministic ordering: smaller hash first
    if asset_x_hash <= asset_y_hash {
        hasher.update(asset_x_hash);
        hasher.update(asset_y_hash);
    } else {
        hasher.update(asset_y_hash);
        hasher.update(asset_x_hash);
    }
    let mut result = [0u8; 32];
    hasher.finalize(&mut result);
    result
}

/// Compute CKB script hash (blake2b-256 of serialized script)
pub fn compute_script_hash(code_hash: &[u8; 32], hash_type: u8, args: &[u8]) -> [u8; 32] {
    // Molecule serialization of Script:
    // total_size(4) + offsets(3*4) + code_hash(32) + hash_type(1) + args(4+len)
    let total_size = 4 + 3 * 4 + 32 + 1 + 4 + args.len();
    let mut data = Vec::with_capacity(total_size);

    // total_size (LE u32)
    data.extend_from_slice(&(total_size as u32).to_le_bytes());
    // 3 offsets
    let offset_code_hash = 4 + 3 * 4;
    let offset_hash_type = offset_code_hash + 32;
    let offset_args = offset_hash_type + 1;
    data.extend_from_slice(&(offset_code_hash as u32).to_le_bytes());
    data.extend_from_slice(&(offset_hash_type as u32).to_le_bytes());
    data.extend_from_slice(&(offset_args as u32).to_le_bytes());
    // code_hash
    data.extend_from_slice(code_hash);
    // hash_type
    data.push(hash_type);
    // args (molecule Bytes: length(LE u32) + data)
    data.extend_from_slice(&(args.len() as u32).to_le_bytes());
    data.extend_from_slice(args);

    let mut hasher = Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    hasher.update(&data);
    let mut result = [0u8; 32];
    hasher.finalize(&mut result);
    result
}
