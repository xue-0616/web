/// Client to communicate with utxo-swap-sequencer API
/// Used for pool creation coordination and token lookups
pub struct SwapClient {
    base_url: String,
    client: reqwest::Client,
}

impl SwapClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn get_pool_info(&self, pool_type_hash: &str) -> anyhow::Result<serde_json::Value> {
        let resp = self.client
            .get(format!("{}/api/v1/pools/by-tokens", self.base_url))
            .query(&[("poolTypeHash", pool_type_hash)])
            .send()
            .await?
            .json()
            .await?;
        Ok(resp)
    }
}
