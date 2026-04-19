/// Bridge validator signer — sign validation attestations with validator private key.
///
/// Implements EIP-712 typed data signing with domain separation to prevent
/// cross-chain signature replay attacks.
use k256::ecdsa::{SigningKey, signature::hazmat::PrehashSigner};
use sha3::{Digest, Keccak256};

/// EIP-712 domain separator components
const EIP712_DOMAIN_TYPEHASH: &str =
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
const BRIDGE_MESSAGE_TYPEHASH: &str =
    "BridgeMessage(uint64 sourceChain,uint64 destChain,address sender,address receiver,address token,uint256 amount,uint256 nonce)";
const DOMAIN_NAME: &str = "UniPassBridge";
const DOMAIN_VERSION: &str = "1";

pub struct ValidatorSigner {
    signing_key: SigningKey,
    wallet: ethers::signers::LocalWallet,
}

impl ValidatorSigner {
    /// Create a new signer from a hex-encoded private key.
    /// Validates key format. The key is NOT logged.
    pub fn new(private_key: &str) -> anyhow::Result<Self> {
        let key_hex = private_key.trim_start_matches("0x");
        let key_bytes = hex::decode(key_hex)
            .map_err(|_| anyhow::anyhow!("Invalid private key hex encoding"))?;
        if key_bytes.len() != 32 {
            anyhow::bail!("Private key must be exactly 32 bytes");
        }
        let signing_key = SigningKey::from_bytes(key_bytes.as_slice().into())
            .map_err(|e| anyhow::anyhow!("Invalid secp256k1 private key: {}", e))?;
        let wallet: ethers::signers::LocalWallet = private_key.parse()?;
        tracing::info!("Validator signer initialized, address: {:?}", {
            use ethers::signers::Signer;
            wallet.address()
        });
        Ok(Self { signing_key, wallet })
    }

    /// Return the validator's Ethereum address (derived from the public key).
    pub fn address(&self) -> ethers::types::Address {
        use ethers::signers::Signer;
        self.wallet.address()
    }

    /// Return a reference to the ethers LocalWallet for transaction signing.
    /// Used by the submitter to sign raw transactions locally before broadcast.
    pub fn wallet(&self) -> &ethers::signers::LocalWallet {
        &self.wallet
    }

    /// Sign a raw 32-byte message hash using secp256k1 ECDSA.
    /// Returns 65-byte signature (r: 32 bytes, s: 32 bytes, v: 1 byte where v = 27 or 28).
    pub fn sign_hash(&self, message_hash: &[u8; 32]) -> anyhow::Result<Vec<u8>> {
        let (signature, recid) = self
            .signing_key
            .sign_prehash(message_hash)
            .map_err(|e| anyhow::anyhow!("Signing failed: {}", e))?;
        let mut sig_bytes = signature.to_bytes().to_vec(); // 64 bytes: r (32) + s (32)
        sig_bytes.push(recid.to_byte() + 27); // v = 27 or 28
        Ok(sig_bytes)
    }

    /// Compute EIP-712 domain separator for a specific chain and bridge contract.
    pub fn domain_separator(chain_id: u64, bridge_contract: &[u8; 20]) -> [u8; 32] {
        let type_hash = Keccak256::digest(EIP712_DOMAIN_TYPEHASH.as_bytes());
        let name_hash = Keccak256::digest(DOMAIN_NAME.as_bytes());
        let version_hash = Keccak256::digest(DOMAIN_VERSION.as_bytes());

        // abi.encode(typeHash, nameHash, versionHash, chainId, verifyingContract)
        let mut encoded = Vec::with_capacity(160);
        encoded.extend_from_slice(&type_hash);
        encoded.extend_from_slice(&name_hash);
        encoded.extend_from_slice(&version_hash);
        // chainId as uint256 (32 bytes, big-endian)
        let mut chain_id_bytes = [0u8; 32];
        chain_id_bytes[24..32].copy_from_slice(&chain_id.to_be_bytes());
        encoded.extend_from_slice(&chain_id_bytes);
        // address as bytes32 (left-padded)
        let mut addr_bytes = [0u8; 32];
        addr_bytes[12..32].copy_from_slice(bridge_contract);
        encoded.extend_from_slice(&addr_bytes);

        let result = Keccak256::digest(&encoded);
        let mut out = [0u8; 32];
        out.copy_from_slice(&result);
        out
    }

    /// Compute the EIP-712 struct hash for a bridge message.
    pub fn bridge_message_hash(
        source_chain: u64,
        dest_chain: u64,
        sender: &[u8; 20],
        receiver: &[u8; 20],
        token: &[u8; 20],
        amount: &[u8; 32], // uint256 big-endian
        nonce: &[u8; 32],  // uint256 big-endian
    ) -> [u8; 32] {
        let type_hash = Keccak256::digest(BRIDGE_MESSAGE_TYPEHASH.as_bytes());

        // abi.encode all fields as 32-byte words
        let mut encoded = Vec::with_capacity(256);
        encoded.extend_from_slice(&type_hash);

        // sourceChain as uint256
        let mut sc = [0u8; 32];
        sc[24..32].copy_from_slice(&source_chain.to_be_bytes());
        encoded.extend_from_slice(&sc);

        // destChain as uint256
        let mut dc = [0u8; 32];
        dc[24..32].copy_from_slice(&dest_chain.to_be_bytes());
        encoded.extend_from_slice(&dc);

        // sender as address (left-padded to 32 bytes)
        let mut s = [0u8; 32];
        s[12..32].copy_from_slice(sender);
        encoded.extend_from_slice(&s);

        // receiver as address
        let mut r = [0u8; 32];
        r[12..32].copy_from_slice(receiver);
        encoded.extend_from_slice(&r);

        // token as address
        let mut t = [0u8; 32];
        t[12..32].copy_from_slice(token);
        encoded.extend_from_slice(&t);

        // amount as uint256
        encoded.extend_from_slice(amount);

        // nonce as uint256
        encoded.extend_from_slice(nonce);

        let result = Keccak256::digest(&encoded);
        let mut out = [0u8; 32];
        out.copy_from_slice(&result);
        out
    }

    /// Compute the full EIP-712 digest: keccak256("\x19\x01" || domainSeparator || structHash)
    pub fn eip712_digest(domain_separator: &[u8; 32], struct_hash: &[u8; 32]) -> [u8; 32] {
        let mut data = Vec::with_capacity(66);
        data.push(0x19);
        data.push(0x01);
        data.extend_from_slice(domain_separator);
        data.extend_from_slice(struct_hash);
        let result = Keccak256::digest(&data);
        let mut out = [0u8; 32];
        out.copy_from_slice(&result);
        out
    }

    /// Sign a bridge message using EIP-712 typed data signing.
    /// This is the primary signing function for bridge validation attestations.
    pub fn sign_bridge_message(
        &self,
        chain_id: u64,
        bridge_contract: &[u8; 20],
        source_chain: u64,
        dest_chain: u64,
        sender: &[u8; 20],
        receiver: &[u8; 20],
        token: &[u8; 20],
        amount: &[u8; 32],
        nonce: &[u8; 32],
    ) -> anyhow::Result<Vec<u8>> {
        let domain_sep = Self::domain_separator(chain_id, bridge_contract);
        let struct_hash =
            Self::bridge_message_hash(source_chain, dest_chain, sender, receiver, token, amount, nonce);
        let digest = Self::eip712_digest(&domain_sep, &struct_hash);
        self.sign_hash(&digest)
    }
}

/// On drop, the SigningKey's memory is already zeroized by k256.
/// We explicitly note this for audit clarity.
impl Drop for ValidatorSigner {
    fn drop(&mut self) {
        tracing::debug!("ValidatorSigner dropped — key material zeroized by k256");
    }
}

/// Verify that a signature was produced by the expected validator address.
/// Returns true if ecrecover(msg_hash, sig) == expected_addr.
pub fn verify_validator_signature(
    msg_hash: &[u8; 32],
    sig: &[u8],
    expected_addr: &[u8; 20],
) -> bool {
    match recover_signer(sig, msg_hash) {
        Ok(recovered) => recovered.as_bytes() == expected_addr,
        Err(e) => {
            tracing::warn!("Signature verification failed during recovery: {}", e);
            false
        }
    }
}

/// Recover signer address from a 65-byte signature and 32-byte message hash.
/// Used for multisig threshold verification.
pub fn recover_signer(signature: &[u8], message_hash: &[u8; 32]) -> anyhow::Result<ethers::types::Address> {
    if signature.len() != 65 {
        anyhow::bail!("Signature must be 65 bytes (r + s + v)");
    }
    let v = signature[64];
    let recovery_id = if v >= 27 { v - 27 } else { v };
    if recovery_id > 1 {
        anyhow::bail!("Invalid recovery id: {}", recovery_id);
    }
    let recid = k256::ecdsa::RecoveryId::from_byte(recovery_id)
        .ok_or_else(|| anyhow::anyhow!("Invalid recovery id"))?;
    let sig = k256::ecdsa::Signature::from_bytes(signature[..64].into())
        .map_err(|e| anyhow::anyhow!("Invalid signature: {}", e))?;
    let verifying_key = k256::ecdsa::VerifyingKey::recover_from_prehash(message_hash, &sig, recid)
        .map_err(|e| anyhow::anyhow!("Recovery failed: {}", e))?;
    let public_key = verifying_key.to_encoded_point(false);
    let public_key_bytes = &public_key.as_bytes()[1..]; // skip 0x04 prefix
    let hash = Keccak256::digest(public_key_bytes);
    let mut address = [0u8; 20];
    address.copy_from_slice(&hash[12..32]);
    Ok(ethers::types::Address::from(address))
}
