use serde::{Deserialize, Serialize};

/// OpenID with email key — used for wallet keyset registration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenIdWithEmailKey {
    pub email_hash: [u8; 32],
    pub pepper: [u8; 32],
    pub issuer: String,
    pub sub: String,
    pub aud: String,
}

impl OpenIdWithEmailKey {
    /// Compute keyset hash component for this key
    ///
    /// BUG-4 fix: Two bugs fixed:
    /// 1. `self.issuer_hash` doesn't exist — compute issuer hash from `self.issuer` string
    /// 2. Return the computed `output`, not hardcoded `[0u8; 32]`
    pub fn key_hash(&self) -> [u8; 32] {
        use tiny_keccak::{Keccak, Hasher};

        // BUG-4 fix: Compute issuer_hash from self.issuer (the field that actually exists)
        let mut issuer_hasher = Keccak::v256();
        issuer_hasher.update(self.issuer.as_bytes());
        let mut issuer_hash = [0u8; 32];
        issuer_hasher.finalize(&mut issuer_hash);

        let mut keccak = Keccak::v256();
        keccak.update(&[0x00, 0x00, 0x00, 0x03]); // KEY_TYPE_OPENID_WITH_EMAIL = 3
        keccak.update(&self.email_hash);
        keccak.update(&self.pepper);
        keccak.update(&issuer_hash); // BUG-4 fix: use computed issuer_hash
        let mut output = [0u8; 32];
        keccak.finalize(&mut output);
        output // BUG-4 fix: return the actual computed hash, not zeros
    }
}
