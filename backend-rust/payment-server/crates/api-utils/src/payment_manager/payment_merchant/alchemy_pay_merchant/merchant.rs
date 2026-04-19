use anyhow::Result;
use serde::{Deserialize, Serialize};

pub struct AlchemyPayMerchant {
    api_url: String,
    app_id: String,
    secret_key: String,
    client: reqwest::Client,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlchemyPayOrderRequest {
    pub merchant_order_no: String,
    pub fiat_currency: String,
    pub crypto_currency: String,
    pub fiat_amount: String,
    pub redirect_url: String,
    pub callback_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlchemyPayOrderResponse {
    pub order_no: String,
    pub pay_url: String,
    pub status: String,
}

impl AlchemyPayMerchant {
    pub fn new(api_url: &str, app_id: &str, secret_key: &str) -> Self {
        Self {
            api_url: api_url.to_string(),
            app_id: app_id.to_string(),
            secret_key: secret_key.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Create on-ramp order (HIGH-01 fix: validate HTTP status)
    pub async fn create_on_ramp_order(&self, req: &AlchemyPayOrderRequest) -> Result<AlchemyPayOrderResponse> {
        let signature = self.sign_request(req)?;
        let resp = self.client
            .post(format!("{}/open/api/v4/merchant/trade/create", self.api_url))
            .header("appId", &self.app_id)
            .header("sign", &signature)
            .json(req)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("AlchemyPay create_on_ramp_order failed (HTTP {}): {}", status, body);
        }

        Ok(resp.json().await?)
    }

    /// Query order status (HIGH-01 + HIGH-02 fix: validate HTTP status + add HMAC signature)
    pub async fn query_order(&self, order_no: &str) -> Result<serde_json::Value> {
        // HIGH-02 fix: sign the query parameters just like create_on_ramp_order
        let sign_str = format!("orderNo={}", order_no);
        use hmac::{Hmac, Mac};
        use sha2::Sha256;
        type HmacSha256 = Hmac<Sha256>;
        let mut mac = HmacSha256::new_from_slice(self.secret_key.as_bytes())?;
        mac.update(sign_str.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        let resp = self.client
            .get(format!("{}/open/api/v4/merchant/trade/query", self.api_url))
            .query(&[("orderNo", order_no)])
            .header("appId", &self.app_id)
            .header("sign", &signature)
            .send().await?;

        // HIGH-01 fix: validate HTTP status
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("AlchemyPay query_order failed (HTTP {}): {}", status, body);
        }

        Ok(resp.json().await?)
    }

    fn sign_request<T: Serialize>(&self, req: &T) -> Result<String> {
        // Serialize request to sorted key=value pairs, HMAC-SHA256 sign
        let json_value = serde_json::to_value(req)?;
        let mut params: Vec<(String, String)> = Vec::new();
        if let Some(obj) = json_value.as_object() {
            for (k, v) in obj {
                let val_str = match v {
                    serde_json::Value::String(s) => s.clone(),
                    other => other.to_string(),
                };
                params.push((k.clone(), val_str));
            }
        }
        params.sort_by(|a, b| a.0.cmp(&b.0));
        let sign_str: String = params.iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join("&");

        use hmac::{Hmac, Mac};
        use sha2::Sha256;
        type HmacSha256 = Hmac<Sha256>;
        let mut mac = HmacSha256::new_from_slice(self.secret_key.as_bytes())?;
        mac.update(sign_str.as_bytes());
        let result = mac.finalize();
        Ok(hex::encode(result.into_bytes()))
    }
}
