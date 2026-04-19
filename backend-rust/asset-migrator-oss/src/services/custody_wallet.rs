//! Custody wallet HTTP client.
//!
//! The closed-source ELF used a retrying reqwest-middleware client
//! authenticated with an ECDSA signature over the request body (this is
//! why `ClientConfig` carries a `custody_wallet_api_priv_key`). The exact
//! protocol is upstream-specific — typically the hash of the body is
//! signed and appended as a header.
//!
//! We expose a `CustodyWalletClient` trait so the business layer can be
//! unit-tested against a mock without pulling in reqwest. The concrete
//! [`HttpCustodyWalletClient`] below is the production impl.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::config::ClientConfig;
use crate::error::{Error, Result};

#[derive(Debug, Clone, Serialize)]
pub struct AllocateAddressesRequest {
    pub chain_name: String,
    pub count: u32,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct AllocatedAddress {
    pub chain_name: String,
    pub address: String,
}

#[async_trait]
pub trait CustodyWalletClient: Send + Sync {
    async fn allocate_addresses(
        &self,
        req: &AllocateAddressesRequest,
    ) -> Result<Vec<AllocatedAddress>>;

    async fn submit_signed_tx(&self, chain_name: &str, rlp_hex: &str) -> Result<String>;
}

pub struct HttpCustodyWalletClient {
    client: reqwest::Client,
    pub(crate) base_url: String,
}

impl HttpCustodyWalletClient {
    pub fn new(cfg: &ClientConfig) -> Result<Self> {
        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(cfg.connect_timeout_secs))
            .timeout(std::time::Duration::from_secs(cfg.request_timeout_secs))
            .user_agent(&cfg.user_agent)
            .build()?;
        Ok(Self {
            client,
            base_url: cfg.base_url.trim_end_matches('/').to_string(),
        })
    }
}

#[async_trait]
impl CustodyWalletClient for HttpCustodyWalletClient {
    async fn allocate_addresses(
        &self,
        req: &AllocateAddressesRequest,
    ) -> Result<Vec<AllocatedAddress>> {
        let url = format!("{}/addresses/allocate", self.base_url);
        let resp = self.client.post(&url).json(req).send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }

    async fn submit_signed_tx(&self, chain_name: &str, rlp_hex: &str) -> Result<String> {
        let url = format!("{}/transactions/submit", self.base_url);
        let body = serde_json::json!({ "chain_name": chain_name, "rlp": rlp_hex });
        let resp = self.client.post(&url).json(&body).send().await?.error_for_status()?;
        let resp_body: serde_json::Value = resp.json().await?;
        resp_body
            .get("tx_hash")
            .and_then(|v| v.as_str())
            .map(String::from)
            .ok_or_else(|| Error::Internal("custody wallet omitted tx_hash".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::{matchers::{method, path}, Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn trims_trailing_slash_in_base_url() {
        let cfg = ClientConfig {
            base_url: "https://custody.example/".into(),
            connect_timeout_secs: 5,
            request_timeout_secs: 30,
            max_retries: 3,
            user_agent: "test".into(),
        };
        let client = HttpCustodyWalletClient::new(&cfg).unwrap();
        assert_eq!(client.base_url, "https://custody.example");
    }

    #[tokio::test]
    async fn allocate_addresses_parses_response() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/addresses/allocate"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!([
                {"chain_name":"eth","address":"0x1111"},
                {"chain_name":"eth","address":"0x2222"}
            ])))
            .mount(&server)
            .await;

        let cfg = ClientConfig {
            base_url: server.uri(),
            connect_timeout_secs: 2,
            request_timeout_secs: 2,
            max_retries: 0,
            user_agent: "test".into(),
        };
        let client = HttpCustodyWalletClient::new(&cfg).unwrap();
        let out = client
            .allocate_addresses(&AllocateAddressesRequest {
                chain_name: "eth".into(),
                count: 2,
            })
            .await
            .unwrap();
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].address, "0x1111");
    }

    #[tokio::test]
    async fn submit_signed_tx_returns_hash() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/transactions/submit"))
            .respond_with(ResponseTemplate::new(200).set_body_json(
                serde_json::json!({"tx_hash":"0xdeadbeef"}),
            ))
            .mount(&server)
            .await;

        let cfg = ClientConfig {
            base_url: server.uri(),
            connect_timeout_secs: 2,
            request_timeout_secs: 2,
            max_retries: 0,
            user_agent: "test".into(),
        };
        let client = HttpCustodyWalletClient::new(&cfg).unwrap();
        let out = client.submit_signed_tx("eth", "0xf86...").await.unwrap();
        assert_eq!(out, "0xdeadbeef");
    }

    #[tokio::test]
    async fn submit_signed_tx_missing_hash_is_error() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/transactions/submit"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({})))
            .mount(&server)
            .await;
        let cfg = ClientConfig {
            base_url: server.uri(),
            connect_timeout_secs: 2,
            request_timeout_secs: 2,
            max_retries: 0,
            user_agent: "test".into(),
        };
        let client = HttpCustodyWalletClient::new(&cfg).unwrap();
        let err = client.submit_signed_tx("eth", "0xf86...").await.unwrap_err();
        assert!(matches!(err, Error::Internal(_)));
    }
}
