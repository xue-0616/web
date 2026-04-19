use ethers::types::Address;
use ethers::utils::keccak256;

/// ERC-1167 minimal proxy prefix: delegates all calls to the implementation (main_module).
/// Layout: 0x3d602d80600a3d3981f3363d3d373d3d3d363d73 ++ <20-byte impl addr> ++ 0x5af43d82803e903d91602b57fd5bf3
const MINIMAL_PROXY_PREFIX: &[u8] = &[
    0x3d, 0x60, 0x2d, 0x80, 0x60, 0x0a, 0x3d, 0x39, 0x81, 0xf3,
    0x36, 0x3d, 0x3d, 0x37, 0x3d, 0x3d, 0x3d, 0x36, 0x3d, 0x73,
];
const MINIMAL_PROXY_SUFFIX: &[u8] = &[
    0x5a, 0xf4, 0x3d, 0x82, 0x80, 0x3e, 0x90, 0x3d, 0x91, 0x60,
    0x2b, 0x57, 0xfd, 0x5b, 0xf3,
];

/// Compute counterfactual wallet address from keyset hash and factory (CRIT-06 fix)
///
/// Uses the correct CREATE2 formula:
///   address = keccak256(0xff ++ factory ++ salt ++ keccak256(init_code))[12..]
///
/// Where `init_code` is the ERC-1167 minimal proxy bytecode pointing to `main_module`,
/// and `salt` is keccak256(keyset_hash).
pub fn compute_wallet_address(
    factory: Address,
    main_module: Address,
    keyset_hash: [u8; 32],
) -> Address {
    let salt = keccak256(&keyset_hash);

    // Build the actual proxy init code (ERC-1167 minimal proxy bytecode)
    // init_code = prefix ++ main_module_address ++ suffix
    let mut init_code = Vec::with_capacity(MINIMAL_PROXY_PREFIX.len() + 20 + MINIMAL_PROXY_SUFFIX.len());
    init_code.extend_from_slice(MINIMAL_PROXY_PREFIX);
    init_code.extend_from_slice(main_module.as_bytes());
    init_code.extend_from_slice(MINIMAL_PROXY_SUFFIX);

    // Hash the init code (CRIT-06 fix: use actual bytecode, not address+salt)
    let init_code_hash = keccak256(&init_code);

    // CREATE2: keccak256(0xff ++ factory ++ salt ++ init_code_hash)[12..]
    let mut data = Vec::with_capacity(1 + 20 + 32 + 32);
    data.push(0xff);
    data.extend_from_slice(factory.as_bytes());
    data.extend_from_slice(&salt);
    data.extend_from_slice(&init_code_hash);
    let hash = keccak256(&data);
    Address::from_slice(&hash[12..])
}

/// Derive keyset hash from key components
pub fn derive_keyset_hash(keys: &[&[u8; 32]]) -> [u8; 32] {
    let mut combined = Vec::new();
    for key in keys {
        combined.extend_from_slice(*key);
    }
    keccak256(&combined)
}
