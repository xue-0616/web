use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Relayer HTTP client — communicates with unipass-wallet-relayer.
/// Includes API key authentication and request signing (FINDING-12).
pub struct RelayerClient {
    base_url: String,
    api_key: String,
    signing_secret: String,
    client: reqwest::Client,
}

impl RelayerClient {
    pub fn new(base_url: &str, api_key: &str, signing_secret: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            api_key: api_key.to_string(),
            signing_secret: signing_secret.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Sign the request body using HMAC-SHA256 with the shared secret
    fn sign_body(&self, body: &[u8]) -> String {
        let mut mac = HmacSha256::new_from_slice(self.signing_secret.as_bytes())
            .expect("HMAC key creation failed");
        mac.update(body);
        hex::encode(mac.finalize().into_bytes())
    }

    pub async fn submit_transaction(&self, chain_id: u64, calldata: &str, signature: &str) -> anyhow::Result<String> {
        let body = serde_json::json!({
            "chainId": chain_id,
            "calldata": calldata,
            "signature": signature,
        });
        let body_bytes = serde_json::to_vec(&body)?;
        let request_signature = self.sign_body(&body_bytes);

        let resp = self.client.post(format!("{}/api/v1/transactions", self.base_url))
            .header("X-API-Key", &self.api_key)
            .header("X-Request-Signature", &request_signature)
            .json(&body)
            .send().await?
            .json::<serde_json::Value>().await?;

        let tx_id = resp["txId"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Relayer response missing txId field"))?
            .to_string();
        Ok(tx_id)
    }

    pub async fn get_meta_nonce(&self, address: &str, chain_id: u64) -> anyhow::Result<u64> {
        let query_str = format!("address={}&chainId={}", address, chain_id);
        let request_signature = self.sign_body(query_str.as_bytes());

        let resp = self.client.get(format!("{}/api/v1/meta-nonce", self.base_url))
            .header("X-API-Key", &self.api_key)
            .header("X-Request-Signature", &request_signature)
            .query(&[("address", address), ("chainId", &chain_id.to_string())])
            .send().await?
            .json::<serde_json::Value>().await?;

        let meta_nonce = resp["metaNonce"]
            .as_u64()
            .ok_or_else(|| anyhow::anyhow!("Relayer response missing metaNonce field"))?;
        Ok(meta_nonce)
    }
}
