//! OIDC JWKS fetcher + fingerprint computation.
//!
//! The closed-source ELF queries `certs_url` (OIDC JWKS endpoint), parses
//! the JWK set, computes a deterministic fingerprint per key, and
//! compares to whatever the on-chain contract currently has registered.
//!
//! A JWK may carry several representations (RSA `n/e`, EC `x/y`, etc.).
//! For DKIM/OpenID monitoring we care about **RSA keys** (`kty=RSA`),
//! and the fingerprint scheme the ELF uses is `keccak256(n || e)` over
//! the big-endian, left-padded public modulus / exponent bytes —
//! matches on-chain `DkimKeysLog` layout recovered from the upstream
//! UniPass contracts.

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

#[derive(Debug, Clone, Deserialize)]
pub struct JwkSet {
    pub keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Jwk {
    pub kty: String,
    pub kid: String,
    #[serde(default)]
    pub alg: Option<String>,
    #[serde(default)]
    #[serde(rename = "use")]
    pub usage: Option<String>,
    /// RSA modulus, base64url-encoded (present iff kty=RSA).
    #[serde(default)]
    pub n: Option<String>,
    /// RSA exponent, base64url-encoded (present iff kty=RSA).
    #[serde(default)]
    pub e: Option<String>,
}

pub async fn fetch(client: &reqwest::Client, certs_url: &str) -> Result<JwkSet> {
    let resp = client.get(certs_url).send().await?;
    let status = resp.status();
    if !status.is_success() {
        return Err(Error::Jwks(format!("{certs_url}: HTTP {status}")));
    }
    let body = resp.bytes().await?;
    let set: JwkSet = serde_json::from_slice(&body)
        .map_err(|e| Error::Jwks(format!("parse {certs_url}: {e}")))?;
    Ok(set)
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct KeyFingerprint {
    pub kid: String,
    /// `keccak256(n_be || e_be)` as 0x-prefixed hex.
    pub fingerprint: String,
}

pub fn fingerprint_rsa_set(set: &JwkSet) -> Vec<KeyFingerprint> {
    let mut out = Vec::new();
    for k in &set.keys {
        if k.kty != "RSA" { continue; }
        let (Some(n), Some(e)) = (k.n.as_deref(), k.e.as_deref()) else { continue };
        let Ok(n_bytes) = b64url_decode(n) else { continue };
        let Ok(e_bytes) = b64url_decode(e) else { continue };
        let fp = keccak256_hex(&n_bytes, &e_bytes);
        out.push(KeyFingerprint {
            kid: k.kid.clone(),
            fingerprint: fp,
        });
    }
    out.sort_by(|a, b| a.kid.cmp(&b.kid));
    out
}

fn b64url_decode(s: &str) -> std::result::Result<Vec<u8>, base64::DecodeError> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    URL_SAFE_NO_PAD.decode(s.trim_end_matches('='))
}

pub fn keccak256_hex(a: &[u8], b: &[u8]) -> String {
    use tiny_keccak::{Hasher, Keccak};
    let mut k = Keccak::v256();
    k.update(a);
    k.update(b);
    let mut out = [0u8; 32];
    k.finalize(&mut out);
    format!("0x{}", hex::encode(out))
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::{
        matchers::{method, path},
        Mock, MockServer, ResponseTemplate,
    };

    const GOOGLE_LIKE_JWKS: &str = r#"{
        "keys": [
            {
                "kty": "RSA",
                "kid": "abc123",
                "alg": "RS256",
                "use": "sig",
                "n": "yQXiMd-xwHGoUvNCrGsU3sUqCDxlj4iUbQwuIg9chOA",
                "e": "AQAB"
            },
            {
                "kty": "EC",
                "kid": "ec-key",
                "x": "someX",
                "y": "someY"
            }
        ]
    }"#;

    #[test]
    fn fingerprint_only_returns_rsa_keys() {
        let set: JwkSet = serde_json::from_str(GOOGLE_LIKE_JWKS).unwrap();
        let fps = fingerprint_rsa_set(&set);
        assert_eq!(fps.len(), 1);
        assert_eq!(fps[0].kid, "abc123");
        assert!(fps[0].fingerprint.starts_with("0x"));
        assert_eq!(fps[0].fingerprint.len(), 2 + 64);
    }

    #[test]
    fn fingerprint_deterministic() {
        let set: JwkSet = serde_json::from_str(GOOGLE_LIKE_JWKS).unwrap();
        let fp1 = fingerprint_rsa_set(&set);
        let fp2 = fingerprint_rsa_set(&set);
        assert_eq!(fp1, fp2);
    }

    #[test]
    fn fingerprint_changes_with_n() {
        let set1: JwkSet = serde_json::from_str(GOOGLE_LIKE_JWKS).unwrap();
        let altered = r#"{"keys":[{"kty":"RSA","kid":"abc123","n":"zzXiMd-xwHGoUvNCrGsU3sUqCDxlj4iUbQwuIg9chOA","e":"AQAB"}]}"#;
        let set2: JwkSet = serde_json::from_str(altered).unwrap();
        let a = fingerprint_rsa_set(&set1)[0].fingerprint.clone();
        let b = fingerprint_rsa_set(&set2)[0].fingerprint.clone();
        assert_ne!(a, b);
    }

    #[test]
    fn fingerprint_skips_rsa_without_n_or_e() {
        let src = r#"{"keys":[{"kty":"RSA","kid":"bad","alg":"RS256"}]}"#;
        let set: JwkSet = serde_json::from_str(src).unwrap();
        assert!(fingerprint_rsa_set(&set).is_empty());
    }

    #[test]
    fn keccak_inputs_are_concatenated_not_hashed_separately() {
        // Guard against regressions that hash n and e separately.
        let a = keccak256_hex(b"", b"ab");
        let b = keccak256_hex(b"a", b"b");
        let c = keccak256_hex(b"ab", b"");
        assert_eq!(a, b, "keccak256(|| n || e) must treat the split as concatenation");
        assert_eq!(a, c);
    }

    #[tokio::test]
    async fn fetch_happy_path() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/oauth2/v3/certs"))
            .respond_with(ResponseTemplate::new(200).set_body_string(GOOGLE_LIKE_JWKS))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let url = format!("{}/oauth2/v3/certs", server.uri());
        let set = fetch(&client, &url).await.unwrap();
        assert_eq!(set.keys.len(), 2);
    }

    #[tokio::test]
    async fn fetch_non_200_is_jwks_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/down"))
            .respond_with(ResponseTemplate::new(503))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let url = format!("{}/down", server.uri());
        let err = fetch(&client, &url).await.unwrap_err();
        assert!(matches!(err, Error::Jwks(_)));
    }

    #[tokio::test]
    async fn fetch_malformed_body_is_jwks_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/bad"))
            .respond_with(ResponseTemplate::new(200).set_body_string("not json at all"))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let url = format!("{}/bad", server.uri());
        let err = fetch(&client, &url).await.unwrap_err();
        assert!(matches!(err, Error::Jwks(_)));
    }
}
