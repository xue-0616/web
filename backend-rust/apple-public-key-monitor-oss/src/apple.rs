//! Apple JWKS fetcher.
//!
//! Apple documents the endpoint at
//! <https://developer.apple.com/documentation/signinwithapplerestapi/fetch_apple_s_public_key_for_verifying_token_signature>
//! as returning a JWK Set: `{ "keys": [ { "kty": "...", "kid": "...", ... } ] }`.
//!
//! For monitoring purposes we only care about the `kid` (Key ID) field —
//! Apple rotates keys by adding a new `kid` and retiring an old one; the
//! downstream id_token verification layer picks the right key by `kid`.

use std::{collections::BTreeSet, time::Duration};

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
}

#[derive(Debug, Deserialize)]
pub struct Jwk {
    /// Key ID — the only field we need for change detection. Apple's keys
    /// carry additional fields (`kty`, `use`, `alg`, `n`, `e`) but we don't
    /// verify signatures here, just watch for rotation.
    pub kid: String,
}

/// Fetch the current JWKS from Apple and return the set of `kid`s.
///
/// `BTreeSet` is used (not `HashSet`) so any ordered iteration the caller
/// does is deterministic — useful for stable diff logs and reproducible
/// snapshots on disk.
pub async fn fetch_kids(
    client: &reqwest::Client,
    url: &str,
    timeout: Duration,
) -> Result<BTreeSet<String>, reqwest::Error> {
    let resp = client
        .get(url)
        .timeout(timeout)
        .send()
        .await?
        .error_for_status()?;
    let jwks: Jwks = resp.json().await?;
    Ok(jwks.keys.into_iter().map(|k| k.kid).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialises_apple_response_shape() {
        // Copied from a real Apple response (abbreviated).
        let body = r#"{
            "keys": [
                { "kty":"RSA","kid":"W6WcOKB","use":"sig","alg":"RS256","n":"2Z…","e":"AQAB" },
                { "kty":"RSA","kid":"YuyXoY","use":"sig","alg":"RS256","n":"1J…","e":"AQAB" }
            ]
        }"#;
        let parsed: Jwks = serde_json::from_str(body).unwrap();
        let kids: BTreeSet<_> = parsed.keys.into_iter().map(|k| k.kid).collect();
        assert_eq!(
            kids,
            ["W6WcOKB", "YuyXoY"].into_iter().map(String::from).collect()
        );
    }

    #[test]
    fn accepts_empty_key_set() {
        let parsed: Jwks = serde_json::from_str(r#"{"keys":[]}"#).unwrap();
        assert!(parsed.keys.is_empty());
    }

    #[test]
    fn tolerates_unknown_extra_fields() {
        // Apple adds new JWK params occasionally (e.g. `ext`, `key_ops`).
        // serde_json defaults drop unknown fields — we want that behaviour.
        let body = r#"{
            "keys":[{"kid":"X","kty":"RSA","use":"sig","alg":"RS256","n":"x","e":"AQAB","ext":true}],
            "__extension":"ignored"
        }"#;
        let parsed: Jwks = serde_json::from_str(body).unwrap();
        assert_eq!(parsed.keys.len(), 1);
        assert_eq!(parsed.keys[0].kid, "X");
    }
}
