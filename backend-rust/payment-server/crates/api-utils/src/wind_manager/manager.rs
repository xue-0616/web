use anyhow::Result;
use super::client::WindClient;

pub struct WindManager {
    client: WindClient,
}

impl WindManager {
    pub fn new(client: WindClient) -> Self {
        Self { client }
    }

    pub async fn process_off_ramp(&self, order_id: &str, amount: &str, currency: &str) -> Result<String> {
        let params = serde_json::json!({
            "orderId": order_id,
            "amount": amount,
            "fiatCurrency": currency,
        });
        let resp = self.client.create_off_ramp_order(&params).await?;
        let wind_order_id = resp["orderId"].as_str().unwrap_or("").to_string();
        Ok(wind_order_id)
    }
}
