use anyhow::Result;
use serde::Deserialize;

use crate::jito_client::{JitoClient, JitoTipDistribution};

/// Dynamic fee estimation combining Helius Priority Fee API + Jito Tip data
pub struct FeeEstimator {
    helius_url: String,
    http_client: reqwest::Client,
}

/// Estimated fees for a transaction
#[derive(Debug, Clone)]
pub struct FeeEstimate {
    /// Priority fee in microlamports per compute unit
    pub priority_fee_micro_lamports: u64,
    /// Jito tip in lamports
    pub jito_tip_lamports: u64,
    /// Total estimated cost in lamports (approximate)
    pub estimated_total_lamports: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeliusPriorityFeeResponse {
    priority_fee_estimate: Option<HeliusFeeEstimate>,
    priority_fee_levels: Option<HeliusFeeLevels>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeliusFeeEstimate {
    // Priority fee in microlamports
    #[serde(default)]
    priority_fee: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeliusFeeLevels {
    #[serde(default)]
    min: f64,
    #[serde(default)]
    low: f64,
    #[serde(default)]
    medium: f64,
    #[serde(default)]
    high: f64,
    #[serde(default)]
    very_high: f64,
    #[serde(default)]
    unsafe_max: f64,
}

impl FeeEstimator {
    pub fn new(helius_api_key: &str) -> Self {
        Self {
            helius_url: format!(
                "https://mainnet.helius-rpc.com/?api-key={}",
                helius_api_key
            ),
            http_client: reqwest::Client::new(),
        }
    }

    pub fn with_rpc_url(rpc_url: &str) -> Self {
        Self {
            helius_url: rpc_url.to_string(),
            http_client: reqwest::Client::new(),
        }
    }

    /// Estimate optimal fees for a Jupiter swap transaction.
    ///
    /// * `consensus_votes` - Number of consensus votes (determines Jito tip tier)
    /// * `jito_client` - Jito client for tip floor data
    /// * `account_keys` - Optional account keys for context-aware fee estimation
    pub async fn estimate_fees(
        &self,
        consensus_votes: u32,
        jito_client: &JitoClient,
        account_keys: Option<Vec<String>>,
    ) -> Result<FeeEstimate> {
        // Fetch priority fee and Jito tip data in parallel
        let (priority_fee_result, tip_result) = tokio::join!(
            self.get_priority_fee(account_keys),
            jito_client.get_tip_floor(),
        );

        let priority_fee = priority_fee_result.unwrap_or_else(|e| {
            tracing::warn!("Priority fee estimation failed, using default: {}", e);
            50_000 // Default: 50,000 microlamports (~reasonable for 2026)
        });

        let jito_tip = match tip_result {
            Ok(tip_data) => JitoClient::select_tip(&tip_data, consensus_votes),
            Err(e) => {
                tracing::warn!("Jito tip floor fetch failed, using default: {}", e);
                // Default fallback: 0.005 SOL (5,000,000 lamports)
                5_000_000
            }
        };

        // Estimate total cost: priority_fee * CU_budget + jito_tip + base_fee
        // Assume ~200,000 CU for a Jupiter swap
        let cu_budget: u64 = 200_000;
        let priority_fee_total = (priority_fee * cu_budget) / 1_000_000; // microlamports → lamports
        let base_fee: u64 = 5_000; // 5000 lamports base fee
        let estimated_total = priority_fee_total + jito_tip + base_fee;

        let estimate = FeeEstimate {
            priority_fee_micro_lamports: priority_fee,
            jito_tip_lamports: jito_tip,
            estimated_total_lamports: estimated_total,
        };

        tracing::info!(
            "Fee estimate: priority={}μL, tip={}L ({}votes), total≈{}L",
            estimate.priority_fee_micro_lamports,
            estimate.jito_tip_lamports,
            consensus_votes,
            estimate.estimated_total_lamports,
        );

        Ok(estimate)
    }

    /// Get priority fee estimate from Helius API.
    /// Returns fee in microlamports per compute unit.
    async fn get_priority_fee(&self, account_keys: Option<Vec<String>>) -> Result<u64> {
        let mut params = vec![serde_json::json!({
            "options": {
                "priorityLevel": "High",
                "includeAllPriorityFeeLevels": true,
            }
        })];

        if let Some(keys) = account_keys {
            params[0]["accountKeys"] = serde_json::json!(keys);
        }

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getPriorityFeeEstimate",
            "params": params
        });

        let resp: serde_json::Value = self
            .http_client
            .post(&self.helius_url)
            .json(&body)
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await?
            .json()
            .await?;

        // Try to get the "high" priority level
        if let Some(levels) = resp["result"]["priorityFeeLevels"].as_object() {
            if let Some(high) = levels.get("high").and_then(|v| v.as_f64()) {
                return Ok(high as u64);
            }
        }

        // Fallback to the single estimate
        if let Some(estimate) = resp["result"]["priorityFeeEstimate"].as_f64() {
            return Ok(estimate as u64);
        }

        anyhow::bail!("Could not parse priority fee from Helius response")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fee_estimate_calculation() {
        let estimate = FeeEstimate {
            priority_fee_micro_lamports: 50_000,
            jito_tip_lamports: 5_000_000,
            estimated_total_lamports: 50_000 * 200_000 / 1_000_000 + 5_000_000 + 5_000,
        };

        // priority: 50000 * 200000 / 1000000 = 10,000 lamports
        // tip: 5,000,000 lamports
        // base: 5,000 lamports
        // total: 5,015,000 lamports ≈ 0.005015 SOL
        assert_eq!(estimate.estimated_total_lamports, 5_015_000);
    }
}
