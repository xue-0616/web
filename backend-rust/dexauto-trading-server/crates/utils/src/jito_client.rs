use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Jito Block Engine endpoints by region
pub const JITO_ENDPOINTS: &[(&str, &str)] = &[
    ("ny", "https://ny.mainnet.block-engine.jito.wtf"),
    ("slc", "https://slc.mainnet.block-engine.jito.wtf"),
    ("amsterdam", "https://amsterdam.mainnet.block-engine.jito.wtf"),
    ("frankfurt", "https://frankfurt.mainnet.block-engine.jito.wtf"),
    ("tokyo", "https://tokyo.mainnet.block-engine.jito.wtf"),
];

/// Jito Tip accounts (randomly select one per bundle to reduce contention)
pub const JITO_TIP_ACCOUNTS: &[&str] = &[
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4bPUBemM2ixJnCA3rTkgrSb",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSLb7jN5IK4T9sUcjsP",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
];

/// Jito tip distribution data for dynamic tip selection
#[derive(Debug, Clone)]
pub struct JitoTipDistribution {
    pub p25: u64,
    pub p50: u64,
    pub p75: u64,
    pub p95: u64,
}

/// Jito Bundle client for MEV-protected transaction submission
pub struct JitoClient {
    endpoint: String,
    http_client: reqwest::Client,
}

#[derive(Serialize)]
struct SendBundleRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct JitoTipFloorResponse {
    #[serde(default)]
    landed_tips_25th_percentile: f64,
    #[serde(default)]
    landed_tips_50th_percentile: f64,
    #[serde(default)]
    landed_tips_75th_percentile: f64,
    #[serde(default)]
    landed_tips_95th_percentile: f64,
}

impl JitoClient {
    pub fn new(region: &str) -> Self {
        let endpoint = JITO_ENDPOINTS
            .iter()
            .find(|(r, _)| *r == region)
            .map(|(_, url)| url.to_string())
            .unwrap_or_else(|| JITO_ENDPOINTS[0].1.to_string());

        Self {
            endpoint,
            http_client: reqwest::Client::new(),
        }
    }

    pub fn with_endpoint(endpoint: &str) -> Self {
        Self {
            endpoint: endpoint.to_string(),
            http_client: reqwest::Client::new(),
        }
    }

    /// Get a random tip account to reduce contention.
    /// Uses a combination of nanosecond timestamp and thread-local counter for better distribution.
    pub fn random_tip_account() -> &'static str {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::time::SystemTime;
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let time_component = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos() as usize;
        let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
        let seed = time_component.wrapping_add(counter);
        JITO_TIP_ACCOUNTS[seed % JITO_TIP_ACCOUNTS.len()]
    }

    /// Send a bundle of transactions (max 5) to Jito Block Engine.
    /// Transactions are executed sequentially and atomically.
    /// All transactions must be base64-encoded signed transactions.
    pub async fn send_bundle(&self, txs_base64: Vec<String>) -> Result<String> {
        if txs_base64.is_empty() {
            anyhow::bail!("Bundle must contain at least 1 transaction");
        }
        if txs_base64.len() > 5 {
            anyhow::bail!("Bundle cannot exceed 5 transactions");
        }

        let params: Vec<serde_json::Value> = txs_base64
            .into_iter()
            .map(serde_json::Value::String)
            .collect();

        let req = SendBundleRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "sendBundle".to_string(),
            params: vec![serde_json::Value::Array(params)],
        };

        let resp: serde_json::Value = self
            .http_client
            .post(format!("{}/api/v1/bundles", self.endpoint))
            .header("Content-Type", "application/json")
            .json(&req)
            .send()
            .await?
            .json()
            .await?;

        if let Some(error) = resp.get("error") {
            anyhow::bail!("Jito sendBundle error: {}", error);
        }

        let bundle_id = resp["result"]
            .as_str()
            .unwrap_or("")
            .to_string();

        tracing::info!("Jito bundle submitted: {}", bundle_id);
        Ok(bundle_id)
    }

    /// Get bundle status by bundle ID
    pub async fn get_bundle_status(&self, bundle_id: &str) -> Result<serde_json::Value> {
        let req = SendBundleRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "getBundleStatuses".to_string(),
            params: vec![serde_json::json!([bundle_id])],
        };

        let resp: serde_json::Value = self
            .http_client
            .post(format!("{}/api/v1/bundles", self.endpoint))
            .json(&req)
            .send()
            .await?
            .json()
            .await?;

        Ok(resp)
    }

    /// Fetch recent Jito tip floor data for dynamic tip calculation.
    /// Returns tip distribution (P25/P50/P75/P95) in lamports.
    pub async fn get_tip_floor(&self) -> Result<JitoTipDistribution> {
        let resp: Vec<JitoTipFloorResponse> = self
            .http_client
            .get(format!("{}/api/v1/bundles/tip_floor", self.endpoint))
            .send()
            .await?
            .json()
            .await?;

        if resp.is_empty() {
            anyhow::bail!("Empty tip floor response from Jito");
        }

        let tip = &resp[0];
        Ok(JitoTipDistribution {
            p25: sol_to_lamports(tip.landed_tips_25th_percentile),
            p50: sol_to_lamports(tip.landed_tips_50th_percentile),
            p75: sol_to_lamports(tip.landed_tips_75th_percentile),
            p95: sol_to_lamports(tip.landed_tips_95th_percentile),
        })
    }

    /// Select optimal Jito tip based on signal strength (consensus votes).
    /// - Normal signal (votes 4-9): use P50 (median) — cost efficient
    /// - Strong signal (votes ≥ 10): use P75 — prioritize landing
    /// Floor: 10,000 lamports (Jito minimum)
    /// Ceiling: 0.01 SOL (10,000,000 lamports) — copy trading doesn't need sniper-tier tips
    pub fn select_tip(tip_data: &JitoTipDistribution, consensus_votes: u32) -> u64 {
        let base_tip = if consensus_votes >= 10 {
            tip_data.p75
        } else {
            tip_data.p50
        };

        // Floor: 10,000 lamports (Jito minimum requirement)
        // Ceiling: 0.01 SOL (copy trading doesn't need to compete for first block)
        base_tip.max(10_000).min(10_000_000)
    }
}

/// Convert SOL to lamports (1 SOL = 1_000_000_000 lamports)
fn sol_to_lamports(sol: f64) -> u64 {
    (sol * 1_000_000_000.0) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_select_tip_normal_signal() {
        let tip_data = JitoTipDistribution {
            p25: 5_000,
            p50: 3_000_000, // 0.003 SOL
            p75: 7_000_000, // 0.007 SOL
            p95: 15_000_000,
        };
        // Normal signal: should use P50
        let tip = JitoClient::select_tip(&tip_data, 5);
        assert_eq!(tip, 3_000_000);
    }

    #[test]
    fn test_select_tip_strong_signal() {
        let tip_data = JitoTipDistribution {
            p25: 5_000,
            p50: 3_000_000,
            p75: 7_000_000,
            p95: 15_000_000,
        };
        // Strong signal (≥10 votes): should use P75
        let tip = JitoClient::select_tip(&tip_data, 12);
        assert_eq!(tip, 7_000_000);
    }

    #[test]
    fn test_select_tip_floor() {
        let tip_data = JitoTipDistribution {
            p25: 100,
            p50: 500,
            p75: 1_000,
            p95: 5_000,
        };
        // Below floor: should use minimum 10,000
        let tip = JitoClient::select_tip(&tip_data, 5);
        assert_eq!(tip, 10_000);
    }

    #[test]
    fn test_select_tip_ceiling() {
        let tip_data = JitoTipDistribution {
            p25: 5_000_000,
            p50: 15_000_000,
            p75: 50_000_000,
            p95: 100_000_000,
        };
        // Above ceiling: should cap at 0.01 SOL
        let tip = JitoClient::select_tip(&tip_data, 5);
        assert_eq!(tip, 10_000_000);
    }

    #[test]
    fn test_random_tip_account() {
        let account = JitoClient::random_tip_account();
        assert!(JITO_TIP_ACCOUNTS.contains(&account));
    }
}
