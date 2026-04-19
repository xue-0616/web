//! DKIM DNS TXT resolution.
//!
//! A DKIM public key lives at `{selector}._domainkey.{domain}` as one or
//! more TXT records. The record payload is a semicolon-separated list
//! of `k=v` tags; the two we care about are `p=` (base64 public key)
//! and `k=` (algorithm, typically `rsa`).
//!
//! We expose a [`DkimResolver`] trait so tests can inject a canned
//! resolver without needing real DNS.

use async_trait::async_trait;
use serde::Serialize;

use crate::error::{Error, Result};

#[async_trait]
pub trait DkimResolver: Send + Sync + 'static {
    /// Query TXT records at `{selector}._domainkey.{domain}` and return
    /// the concatenated payload (same behaviour as `dig +short TXT`).
    async fn txt(&self, domain: &str, selector: &str) -> Result<Vec<String>>;
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DkimRecord {
    pub domain: String,
    pub selector: String,
    /// Base64-encoded RSA public key, or `None` if the record has no `p=`
    /// tag or the tag is empty (a "revoked" DKIM record per RFC 6376).
    pub public_key_b64: Option<String>,
    /// Algorithm identifier (`k=` tag), default `rsa`.
    pub algorithm: String,
    /// `keccak256(der_encoded_spki)` of the public key, 0x-prefixed.
    /// `None` if public_key_b64 is None (revoked record).
    pub fingerprint: Option<String>,
}

pub async fn fetch_one<R: DkimResolver>(
    resolver: &R,
    domain: &str,
    selector: &str,
) -> Result<DkimRecord> {
    let records = resolver.txt(domain, selector).await?;
    if records.is_empty() {
        return Err(Error::Dns(format!(
            "no TXT records at {selector}._domainkey.{domain}"
        )));
    }
    let joined = records.join("");
    let (pk, alg) = parse_dkim_record(&joined);
    let fingerprint = pk.as_deref().map(|b64| fingerprint_public_key(b64));

    Ok(DkimRecord {
        domain: domain.to_string(),
        selector: selector.to_string(),
        public_key_b64: pk,
        algorithm: alg,
        fingerprint,
    })
}

/// Return `(p_value, k_value_or_rsa_default)`.
pub fn parse_dkim_record(txt: &str) -> (Option<String>, String) {
    let mut p = None;
    let mut k = "rsa".to_string();
    for tag in txt.split(';') {
        let tag = tag.trim();
        if let Some(v) = tag.strip_prefix("p=") {
            let v = v.trim().replace(char::is_whitespace, "");
            p = if v.is_empty() { None } else { Some(v) };
        } else if let Some(v) = tag.strip_prefix("k=") {
            k = v.trim().to_string();
        }
    }
    (p, k)
}

/// Keccak256 over the raw DER-encoded public key (the base64-decoded
/// bytes). This matches how on-chain `DkimKeysLog` identifies a key.
pub fn fingerprint_public_key(pk_b64: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use tiny_keccak::{Hasher, Keccak};
    let bytes = STANDARD.decode(pk_b64).unwrap_or_default();
    let mut k = Keccak::v256();
    k.update(&bytes);
    let mut out = [0u8; 32];
    k.finalize(&mut out);
    format!("0x{}", hex::encode(out))
}

// ------------------------------------------------------------------
// Test / stub resolver
// ------------------------------------------------------------------

#[derive(Debug, Default, Clone)]
pub struct StubResolver {
    /// Keyed by `(domain, selector)` → Vec of TXT payload strings.
    pub responses: std::collections::HashMap<(String, String), Vec<String>>,
}

#[async_trait]
impl DkimResolver for StubResolver {
    async fn txt(&self, domain: &str, selector: &str) -> Result<Vec<String>> {
        Ok(self
            .responses
            .get(&(domain.to_string(), selector.to_string()))
            .cloned()
            .unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_standard_dkim_record() {
        let txt = "v=DKIM1; k=rsa; p=MIGfMA0GCSq";
        let (p, k) = parse_dkim_record(txt);
        assert_eq!(p.as_deref(), Some("MIGfMA0GCSq"));
        assert_eq!(k, "rsa");
    }

    #[test]
    fn parses_record_with_whitespace_in_p() {
        // DNS TXT records often split long keys; concatenation then
        // strips inner whitespace.
        let txt = "v=DKIM1; k=rsa; p=AAAA BBBB CCCC";
        let (p, _) = parse_dkim_record(txt);
        assert_eq!(p.as_deref(), Some("AAAABBBBCCCC"));
    }

    #[test]
    fn parses_revoked_record() {
        let txt = "v=DKIM1; k=rsa; p=";
        let (p, _) = parse_dkim_record(txt);
        assert_eq!(p, None);
    }

    #[test]
    fn defaults_algorithm_to_rsa() {
        let txt = "v=DKIM1; p=xyz";
        let (_, k) = parse_dkim_record(txt);
        assert_eq!(k, "rsa");
    }

    #[test]
    fn fingerprint_is_deterministic_and_hex() {
        let fp1 = fingerprint_public_key("aGVsbG8=");
        let fp2 = fingerprint_public_key("aGVsbG8=");
        assert_eq!(fp1, fp2);
        assert!(fp1.starts_with("0x") && fp1.len() == 66);
    }

    #[test]
    fn fingerprint_differs_per_key() {
        let a = fingerprint_public_key("aGVsbG8=");
        let b = fingerprint_public_key("d29ybGQ=");
        assert_ne!(a, b);
    }

    #[tokio::test]
    async fn fetch_one_returns_record() {
        let mut stub = StubResolver::default();
        stub.responses.insert(
            ("gmail.com".into(), "20230601".into()),
            vec!["v=DKIM1; k=rsa; p=QUJD".into()],
        );
        let rec = fetch_one(&stub, "gmail.com", "20230601").await.unwrap();
        assert_eq!(rec.domain, "gmail.com");
        assert_eq!(rec.public_key_b64.as_deref(), Some("QUJD"));
        assert_eq!(rec.algorithm, "rsa");
        assert!(rec.fingerprint.is_some());
    }

    #[tokio::test]
    async fn fetch_one_revoked_key_reports_no_fingerprint() {
        let mut stub = StubResolver::default();
        stub.responses.insert(
            ("bad.com".into(), "sel".into()),
            vec!["v=DKIM1; p=".into()],
        );
        let rec = fetch_one(&stub, "bad.com", "sel").await.unwrap();
        assert_eq!(rec.public_key_b64, None);
        assert_eq!(rec.fingerprint, None);
    }

    #[tokio::test]
    async fn fetch_one_missing_record_returns_dns_error() {
        let stub = StubResolver::default();
        let err = fetch_one(&stub, "nowhere", "sel").await.unwrap_err();
        assert!(matches!(err, Error::Dns(_)));
    }
}
