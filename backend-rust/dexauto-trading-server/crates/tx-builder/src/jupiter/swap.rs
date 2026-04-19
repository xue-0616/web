use api_common::operator_key::SolanaSwapRequest;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Jupiter V2 API base URL
pub const JUPITER_V2_API: &str = "https://api.jup.ag/swap/v1";

/// HTTP request timeout for Jupiter API calls (30 seconds).
const JUPITER_REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// Maximum number of retries for transient Jupiter API errors (Audit #29).
const JUPITER_MAX_RETRIES: u32 = 3;

/// Base delay between retries (exponential back-off).
const JUPITER_RETRY_BASE_DELAY: Duration = Duration::from_millis(500);

/// Price impact warning threshold (percentage). Quotes with higher impact are logged as warnings.
const PRICE_IMPACT_WARN_THRESHOLD: f64 = 3.0;

/// Price impact rejection threshold (percentage). Quotes exceeding this are rejected (Audit #8).
const PRICE_IMPACT_REJECT_THRESHOLD: f64 = 5.0;

/// Jupiter V2 quote API request parameters
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JupiterQuoteRequest {
    pub input_mint: String,
    pub output_mint: String,
    pub amount: String,
    pub slippage_bps: u16,
    pub swap_mode: String,
    /// Restrict intermediate tokens to reduce routing risk
    pub restrict_intermediate_tokens: bool,
}

/// Jupiter V2 quote response
#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JupiterQuoteResponse {
    pub input_mint: String,
    pub output_mint: String,
    pub in_amount: String,
    pub out_amount: String,
    pub other_amount_threshold: String,
    pub swap_mode: String,
    pub price_impact_pct: Option<String>,
    pub route_plan: Vec<serde_json::Value>,
    #[serde(default)]
    pub context_slot: Option<u64>,
}

/// Jupiter V2 swap API request (POST body)
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JupiterSwapRequest {
    pub user_public_key: String,
    pub quote_response: serde_json::Value,
    pub wrap_and_unwrap_sol: bool,
    /// Let Jupiter automatically calculate optimal CU limit
    pub dynamic_compute_unit_limit: bool,
    /// Let Jupiter auto-optimize slippage based on route
    pub dynamic_slippage: bool,
    /// Priority fee configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prioritization_fee_lamports: Option<PrioritizationFee>,
}

/// Priority fee configuration for Jupiter V2
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrioritizationFee {
    pub priority_level_with_max_lamports: PriorityLevelConfig,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityLevelConfig {
    /// Maximum priority fee in lamports
    pub max_lamports: u64,
    /// Priority level: "min", "low", "medium", "high", "veryHigh"
    pub priority_level: String,
}

/// Jupiter V2 swap API response
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JupiterSwapResponse {
    /// base64 encoded transaction
    pub swap_transaction: String,
    /// Estimated priority fee used
    #[serde(default)]
    pub priority_fee_lamports: Option<u64>,
    /// Dynamic slippage info
    #[serde(default)]
    pub dynamic_slippage_report: Option<serde_json::Value>,
}

/// Returns true if the HTTP status code is a transient error worth retrying.
fn is_transient_http_error(status: reqwest::StatusCode) -> bool {
    matches!(
        status.as_u16(),
        429 | 502 | 503 | 504
    )
}

/// Get swap quote from Jupiter V2 API.
///
/// Includes:
/// - Zero-amount guard (Audit #30)
/// - Retry logic for transient 429/502/503/504 errors (Audit #29)
pub async fn get_quote(
    api_key: Option<&str>,
    req: &SolanaSwapRequest,
) -> anyhow::Result<JupiterQuoteResponse> {
    // Guard: reject zero amount before making the API call (Audit #30)
    if req.amount_specified == 0 {
        anyhow::bail!("amount_specified must be > 0; refusing to request a zero-value quote");
    }

    let client = reqwest::Client::builder()
        .timeout(JUPITER_REQUEST_TIMEOUT)
        .build()?;
    let swap_mode = match req.swap_type {
        api_common::operator_key::SwapType::ExactIn => "ExactIn",
        api_common::operator_key::SwapType::ExactOut => "ExactOut",
    };

    let mut last_error: Option<anyhow::Error> = None;

    for attempt in 0..=JUPITER_MAX_RETRIES {
        if attempt > 0 {
            let delay = JUPITER_RETRY_BASE_DELAY * 2u32.saturating_pow(attempt - 1);
            tracing::warn!(
                "Jupiter quote retry {}/{} after {:?}",
                attempt, JUPITER_MAX_RETRIES, delay,
            );
            tokio::time::sleep(delay).await;
        }

        let mut request = client
            .get(format!("{}/quote", JUPITER_V2_API))
            .query(&[
                ("inputMint", req.input_mint.as_str()),
                ("outputMint", req.output_mint.as_str()),
                ("amount", &req.amount_specified.to_string()),
                ("slippageBps", &req.slippage_bps.to_string()),
                ("swapMode", swap_mode),
                ("restrictIntermediateTokens", "true"),
            ]);

        if let Some(key) = api_key {
            request = request.header("x-api-key", key);
        }

        let response = match request.send().await {
            Ok(resp) => resp,
            Err(e) => {
                last_error = Some(e.into());
                continue; // network error — retry
            }
        };

        let status = response.status();
        if is_transient_http_error(status) {
            last_error = Some(anyhow::anyhow!("Jupiter quote API returned transient error: {}", status));
            continue; // transient — retry
        }

        let response = response
            .error_for_status()
            .map_err(|e| anyhow::anyhow!("Jupiter quote API returned error: {}", e))?;

        let quote: JupiterQuoteResponse = response.json().await?;

        // Log price impact for monitoring and reject if too high
        if let Some(ref impact) = quote.price_impact_pct {
            let impact_val: f64 = impact.parse().unwrap_or(0.0);
            if impact_val > PRICE_IMPACT_REJECT_THRESHOLD {
                anyhow::bail!(
                    "Price impact too high: {:.2}% exceeds {:.1}% threshold for {} → {}",
                    impact_val, PRICE_IMPACT_REJECT_THRESHOLD,
                    req.input_mint, req.output_mint
                );
            }
            if impact_val > PRICE_IMPACT_WARN_THRESHOLD {
                tracing::warn!(
                    "High price impact: {}% for {} → {}",
                    impact, req.input_mint, req.output_mint
                );
            }
        }

        return Ok(quote);
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Jupiter quote failed after retries")))
}

/// Build swap transaction via Jupiter V2 API with dynamic features.
///
/// Key V2 features:
/// - `dynamicSlippage`: Jupiter auto-optimizes slippage per route
/// - `dynamicComputeUnitLimit`: Jupiter calculates optimal CU
/// - `prioritizationFeeLamports`: Context-aware priority fee
///
/// Includes retry logic for transient HTTP errors (Audit #29).
pub async fn build_swap_tx(
    api_key: Option<&str>,
    user_pubkey: &str,
    quote: &JupiterQuoteResponse,
    max_priority_fee_lamports: u64,
) -> anyhow::Result<Vec<u8>> {
    let client = reqwest::Client::builder()
        .timeout(JUPITER_REQUEST_TIMEOUT)
        .build()?;
    let swap_req = JupiterSwapRequest {
        user_public_key: user_pubkey.to_string(),
        quote_response: serde_json::to_value(quote)?,
        wrap_and_unwrap_sol: true,
        dynamic_compute_unit_limit: true,
        dynamic_slippage: true,
        prioritization_fee_lamports: Some(PrioritizationFee {
            priority_level_with_max_lamports: PriorityLevelConfig {
                max_lamports: max_priority_fee_lamports,
                priority_level: "veryHigh".to_string(),
            },
        }),
    };

    let mut last_error: Option<anyhow::Error> = None;

    for attempt in 0..=JUPITER_MAX_RETRIES {
        if attempt > 0 {
            let delay = JUPITER_RETRY_BASE_DELAY * 2u32.saturating_pow(attempt - 1);
            tracing::warn!(
                "Jupiter swap-tx retry {}/{} after {:?}",
                attempt, JUPITER_MAX_RETRIES, delay,
            );
            tokio::time::sleep(delay).await;
        }

        let mut request = client.post(format!("{}/swap", JUPITER_V2_API));
        if let Some(key) = api_key {
            request = request.header("x-api-key", key);
        }

        let response = match request
            .header("Content-Type", "application/json")
            .json(&swap_req)
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                last_error = Some(e.into());
                continue;
            }
        };

        let status = response.status();
        if is_transient_http_error(status) {
            last_error = Some(anyhow::anyhow!("Jupiter swap API returned transient error: {}", status));
            continue;
        }

        let response = response
            .error_for_status()
            .map_err(|e| anyhow::anyhow!("Jupiter swap API returned error: {}", e))?;

        let resp: JupiterSwapResponse = response.json().await?;

        if let Some(slippage_report) = &resp.dynamic_slippage_report {
            tracing::info!("Jupiter dynamic slippage: {}", slippage_report);
        }

        let tx_bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &resp.swap_transaction,
        )?;
        return Ok(tx_bytes);
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Jupiter swap-tx failed after retries")))
}

/// Check entry price deviation between our entry price and smart money's average entry price.
/// Returns deviation as a percentage (e.g., 0.05 = 5%).
/// If deviation > max_deviation_pct, the trade should be skipped.
///
/// NOTE: Uses f64 arithmetic which is acceptable for percentage-based deviation
/// checks (approximate comparison) but should NOT be used for precise financial amounts.
pub fn check_entry_deviation(
    our_out_amount: &str,
    smart_money_avg_out_amount: &str,
    max_deviation_pct: f64,
) -> anyhow::Result<(f64, bool)> {
    let our_amount: f64 = our_out_amount.parse()?;
    let sm_amount: f64 = smart_money_avg_out_amount.parse()?;

    if sm_amount == 0.0 {
        anyhow::bail!("Smart money average out amount is 0");
    }

    // We get fewer tokens for the same SOL = higher entry price = worse deal
    let deviation = (sm_amount - our_amount) / sm_amount;
    let passes = deviation <= max_deviation_pct;

    if !passes {
        tracing::warn!(
            "Entry deviation too high: {:.2}% > {:.2}% max (our={}, sm={})",
            deviation * 100.0,
            max_deviation_pct * 100.0,
            our_out_amount,
            smart_money_avg_out_amount
        );
    }

    Ok((deviation, passes))
}
