pub use crate::wind_manager::client::WindClient;

/// Wind merchant wraps WindClient for payment merchant interface (MED-06 fix: validate input)
pub struct WindMerchant {
    client: WindClient,
}

impl WindMerchant {
    pub fn new(client: WindClient) -> Self { Self { client } }

    /// Process off-ramp via Wind (MED-06 fix: validate required fields before forwarding)
    pub async fn process_off_ramp(&self, params: &serde_json::Value) -> anyhow::Result<serde_json::Value> {
        // MED-06 fix: Validate required fields before forwarding to Wind API
        let required_fields = ["amount", "fiatCurrency", "country"];
        for field in &required_fields {
            if params.get(field).is_none() {
                anyhow::bail!("Missing required field '{}' in Wind off-ramp request", field);
            }
        }

        // Validate amount is a positive number
        if let Some(amount_val) = params.get("amount") {
            let amount_str = amount_val.as_str().unwrap_or("");
            let amount: f64 = amount_str.parse().map_err(|_| {
                anyhow::anyhow!("Invalid amount '{}': must be a numeric value", amount_str)
            })?;
            if amount <= 0.0 {
                anyhow::bail!("Amount must be positive, got {}", amount);
            }
        }

        self.client.create_off_ramp_order(params).await
    }
}
