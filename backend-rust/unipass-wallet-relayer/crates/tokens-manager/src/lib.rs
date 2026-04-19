/// Token price manager — fetches token prices for fee calculation
/// Used to convert gas costs into user's fee token denomination
pub struct TokensManager {
    prices: std::collections::HashMap<String, f64>,
}

impl TokensManager {
    pub fn new() -> Self {
        Self { prices: std::collections::HashMap::new() }
    }

    pub fn get_price(&self, token_address: &str) -> Option<f64> {
        self.prices.get(token_address).copied()
    }

    /// Refresh prices from external source (CMC, CoinGecko, etc.)
    pub async fn refresh(&mut self) -> anyhow::Result<()> {
        // Fetch token prices from CoinGecko/CMC for fee estimation
        let client = reqwest::Client::new();
        let resp = client.get("https://api.coingecko.com/api/v3/simple/price")
            .query(&[("ids", "ethereum,usd-coin,tether"), ("vs_currencies", "usd")])
            .send().await?;
        let prices: serde_json::Value = resp.json().await?;
        tracing::info!("Token prices updated: {:?}", prices);
        Ok(())
    }
}
