//! JWT issuance + verification.
//!
//! `snap-server` uses HS256 JWTs carrying the `account_id`, `provider_type`,
//! and `wallet_address` so downstream handlers can authorise without
//! re-querying the DB on every request.

use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{
    DecodingKey, EncodingKey, Header, Validation,
    decode, encode,
};
use serde::{Deserialize, Serialize};

use crate::{common::ProviderType, error::Error};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Claims {
    /// Internal `snap_account.id`.
    pub sub: i64,
    /// Wallet address, 0x-prefixed hex, lowercase.
    pub wallet: String,
    pub provider: ProviderType,
    /// Unix seconds.
    pub exp: u64,
    /// Unix seconds.
    pub iat: u64,
    pub iss: String,
}

pub struct JwtIssuer {
    encoding: EncodingKey,
    decoding: DecodingKey,
    issuer: String,
    ttl_secs: u64,
}

impl JwtIssuer {
    pub fn new(secret: &str, issuer: &str, ttl_secs: u64) -> Self {
        // The config layer accepts either hex-encoded (preferred) or raw
        // ASCII. Both are valid for HS256 as long as ≥32 bytes after
        // decode.
        let bytes = if secret.len() % 2 == 0 && secret.bytes().all(|b| b.is_ascii_hexdigit()) {
            hex::decode(secret).unwrap_or_else(|_| secret.as_bytes().to_vec())
        } else {
            secret.as_bytes().to_vec()
        };
        Self {
            encoding: EncodingKey::from_secret(&bytes),
            decoding: DecodingKey::from_secret(&bytes),
            issuer: issuer.to_string(),
            ttl_secs,
        }
    }

    pub fn issue(
        &self,
        account_id: i64,
        wallet: &str,
        provider: ProviderType,
    ) -> Result<String, Error> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let claims = Claims {
            sub: account_id,
            wallet: wallet.to_string(),
            provider,
            iat: now,
            exp: now + self.ttl_secs,
            iss: self.issuer.clone(),
        };
        Ok(encode(&Header::default(), &claims, &self.encoding)?)
    }

    pub fn verify(&self, token: &str) -> Result<Claims, Error> {
        let mut v = Validation::default();
        v.set_issuer(&[self.issuer.clone()]);
        // Zero leeway on `exp` — the closed-source ELF also enforced
        // hard expiry for short-lived tokens.
        v.leeway = 0;
        let data = decode::<Claims>(token, &self.decoding, &v)?;
        Ok(data.claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk() -> JwtIssuer {
        JwtIssuer::new(
            "0000000000000000000000000000000000000000000000000000000000000000",
            "unipass-test",
            3600,
        )
    }

    #[test]
    fn issue_then_verify_roundtrip() {
        let j = mk();
        let token = j.issue(42, "0xabcdef", ProviderType::Snap).unwrap();
        let claims = j.verify(&token).unwrap();
        assert_eq!(claims.sub, 42);
        assert_eq!(claims.wallet, "0xabcdef");
        assert_eq!(claims.provider, ProviderType::Snap);
        assert_eq!(claims.iss, "unipass-test");
        assert!(claims.exp > claims.iat);
    }

    #[test]
    fn verify_rejects_garbage_token() {
        let j = mk();
        assert!(matches!(j.verify("not a jwt"), Err(Error::Jwt(_))));
    }

    #[test]
    fn verify_rejects_wrong_issuer() {
        let j1 = mk();
        let j2 = JwtIssuer::new(
            "0000000000000000000000000000000000000000000000000000000000000000",
            "other-issuer",
            3600,
        );
        let token = j1.issue(1, "0xabc", ProviderType::Snap).unwrap();
        assert!(matches!(j2.verify(&token), Err(Error::Jwt(_))));
    }

    #[test]
    fn verify_rejects_wrong_secret() {
        let j1 = mk();
        let j2 = JwtIssuer::new(
            "1111111111111111111111111111111111111111111111111111111111111111",
            "unipass-test",
            3600,
        );
        let token = j1.issue(1, "0xabc", ProviderType::Snap).unwrap();
        assert!(matches!(j2.verify(&token), Err(Error::Jwt(_))));
    }

    #[test]
    fn expired_token_is_rejected() {
        // Issue a 0-second-TTL token — it should fail validation because
        // jsonwebtoken's default validation checks `exp >= now`.
        let j = JwtIssuer::new(
            "0000000000000000000000000000000000000000000000000000000000000000",
            "unipass-test",
            0,
        );
        // Wait a little to let the clock move past `exp`.
        let token = j.issue(1, "0xabc", ProviderType::Snap).unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));
        assert!(matches!(j.verify(&token), Err(Error::Jwt(_))));
    }
}
