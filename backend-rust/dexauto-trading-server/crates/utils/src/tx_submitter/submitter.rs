use anyhow::Result;
use zeroize::Zeroizing;
use crate::jito_client::JitoClient;

/// Signal strength level for determining submission priority and tip amount
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SignalStrength {
    High,
    Normal,
    Low,
}

impl SignalStrength {
    pub fn from_consensus_votes(votes: u32) -> Self {
        if votes >= 10 {
            Self::High
        } else if votes >= 4 {
            Self::Normal
        } else {
            Self::Low
        }
    }
}

/// Bundle submission result with landing confirmation
#[derive(Debug)]
pub struct BundleResult {
    pub bundle_id: String,
    pub landed: bool,
    pub slot: Option<u64>,
}

/// Transaction submitter with tiered routing:
///   1. Jito Bundle with separate tip tx (primary — MEV protected + atomic)
///   2. Staked RPC (high-signal fallback — SWQoS priority inclusion)
///   3. Standard RPC (last resort)
pub struct TxSubmitter {
    rpc_url: String,
    staked_rpc_url: Option<String>,
    jito_client: JitoClient,
    http_client: reqwest::Client,
    /// Fee payer keypair bytes for signing tip transactions.
    /// Wrapped in Zeroizing to ensure bytes are zeroed on drop (prevents leaks via swap/core dump).
    fee_payer_keypair: Option<Zeroizing<Vec<u8>>>,
    /// Whether to skip preflight simulation on RPC sendTransaction (Audit #43).
    /// Default: `true` for speed on fallback paths, but can be set to `false` for extra safety.
    skip_preflight: bool,
}

impl TxSubmitter {
    pub fn new(rpc_url: &str, jito_region: &str) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            staked_rpc_url: None,
            jito_client: JitoClient::new(jito_region),
            http_client: reqwest::Client::new(),
            fee_payer_keypair: None,
            skip_preflight: true,
        }
    }

    pub fn with_jito_endpoint(rpc_url: &str, jito_endpoint: &str) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            staked_rpc_url: None,
            jito_client: JitoClient::with_endpoint(jito_endpoint),
            http_client: reqwest::Client::new(),
            fee_payer_keypair: None,
            skip_preflight: true,
        }
    }

    pub fn with_staked_rpc(mut self, staked_rpc_url: &str) -> Self {
        if !staked_rpc_url.is_empty() {
            self.staked_rpc_url = Some(staked_rpc_url.to_string());
            tracing::info!("SWQoS staked RPC configured: {}", staked_rpc_url);
        }
        self
    }

    pub fn with_fee_payer(mut self, keypair_bytes: Vec<u8>) -> Self {
        self.fee_payer_keypair = Some(Zeroizing::new(keypair_bytes));
        self
    }

    /// Configure whether RPC fallback submissions skip preflight simulation (Audit #43).
    /// Default is `true` (skip) for speed; set to `false` for extra safety.
    pub fn with_skip_preflight(mut self, skip: bool) -> Self {
        self.skip_preflight = skip;
        self
    }

    /// Submit a swap transaction as a 2-tx atomic Jito Bundle:
    ///   TX 1: The swap transaction (Jupiter/Raydium)
    ///   TX 2: Jito tip transfer to a random tip account
    ///
    /// If the swap fails, the tip is NOT paid (atomic execution).
    /// If Jito fails entirely, falls back to Staked RPC / Standard RPC.
    pub async fn submit(&self, tx_bytes: &[u8], is_anti_mev: bool) -> Result<String> {
        self.submit_full(tx_bytes, is_anti_mev, 0, SignalStrength::Normal).await
    }

    /// Full submission with bribery amount and signal strength.
    pub async fn submit_full(
        &self,
        tx_bytes: &[u8],
        is_anti_mev: bool,
        bribery_amount: u64,
        signal: SignalStrength,
    ) -> Result<String> {
        let swap_base64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD, tx_bytes,
        );

        // Determine effective tip: use bribery_amount if provided, else fetch dynamic tip
        let tip_lamports = if bribery_amount > 0 {
            bribery_amount
        } else {
            // Fetch real-time tip floor from Jito and select based on signal strength
            match self.jito_client.get_tip_floor().await {
                Ok(tip_data) => {
                    let votes = match signal {
                        SignalStrength::High => 10,
                        SignalStrength::Normal => 5,
                        SignalStrength::Low => 2,
                    };
                    JitoClient::select_tip(&tip_data, votes)
                }
                Err(e) => {
                    tracing::warn!("Failed to fetch Jito tip floor: {}, using default 100k", e);
                    100_000 // 0.0001 SOL default
                }
            }
        };

        // Pre-flight: simulate swap TX to catch CU-drain hooks before spending tip
        if let Err(e) = self.preflight_simulate(&swap_base64).await {
            tracing::warn!("Pre-flight simulation rejected: {}", e);
            anyhow::bail!("Pre-flight CU check failed: {}", e);
        }

        // Primary: Jito Bundle with separate tip transaction
        let bundle_result = self.submit_jito_bundle(&swap_base64, tip_lamports).await;
        match bundle_result {
            Ok(result) => {
                if result.landed {
                    tracing::info!(
                        "Jito Bundle LANDED: {} (slot: {:?}, tip: {} lamports)",
                        result.bundle_id, result.slot, tip_lamports,
                    );
                } else {
                    tracing::info!(
                        "Jito Bundle submitted (pending): {} (tip: {} lamports)",
                        result.bundle_id, tip_lamports,
                    );
                }
                return Ok(result.bundle_id);
            }
            Err(e) => {
                tracing::warn!("Jito Bundle failed: {}", e);
                if is_anti_mev {
                    anyhow::bail!("Jito Bundle failed and anti-MEV required: {}", e);
                }
            }
        }

        // Fallback tier 1: Staked RPC for high-signal transactions
        if signal == SignalStrength::High {
            if let Some(ref staked_url) = self.staked_rpc_url {
                tracing::info!("High-signal TX: routing through staked RPC (SWQoS)");
                match self.submit_via_rpc_endpoint(&swap_base64, staked_url).await {
                    Ok(sig) => {
                        tracing::info!("TX submitted via staked RPC (SWQoS): {}", sig);
                        return Ok(sig);
                    }
                    Err(e) => {
                        tracing::warn!("Staked RPC failed: {}", e);
                    }
                }
            }
        }

        // Fallback tier 2: Standard RPC
        tracing::info!("Falling back to standard RPC");
        self.submit_via_rpc_endpoint(&swap_base64, &self.rpc_url).await
    }

    /// Build and submit a 2-tx atomic Jito Bundle, then poll for landing confirmation.
    async fn submit_jito_bundle(
        &self,
        swap_tx_base64: &str,
        tip_lamports: u64,
    ) -> Result<BundleResult> {
        let mut bundle_txs = vec![swap_tx_base64.to_string()];

        // Build tip transaction if we have a fee payer keypair and tip > 0
        if tip_lamports > 0 {
            if let Some(ref keypair_bytes) = self.fee_payer_keypair {
                // Select tip account once and pass it to build_tip_tx so the log matches (Audit #42).
                let tip_account = JitoClient::random_tip_account();
                match self.build_tip_tx(keypair_bytes, tip_lamports, tip_account).await {
                    Ok(tip_base64) => {
                        bundle_txs.push(tip_base64);
                        tracing::debug!(
                            "Bundle: swap + tip ({} lamports to {})",
                            tip_lamports,
                            tip_account,
                        );
                    }
                    Err(e) => {
                        tracing::warn!("Failed to build tip tx, sending swap only: {}", e);
                    }
                }
            } else {
                tracing::debug!("No fee payer keypair, sending swap tx only in bundle");
            }
        }

        // Submit bundle
        let bundle_id = self.jito_client.send_bundle(bundle_txs).await?;

        // Poll for landing confirmation (up to 15 seconds)
        let landed_result = self.poll_bundle_status(&bundle_id, 15).await;

        Ok(BundleResult {
            bundle_id,
            landed: landed_result.is_some(),
            slot: landed_result,
        })
    }

    /// Build a SOL transfer transaction to a Jito tip account.
    /// The `tip_account_str` is pre-selected by the caller to ensure log consistency (Audit #42).
    async fn build_tip_tx(
        &self,
        keypair_bytes: &[u8],
        tip_lamports: u64,
        tip_account_str: &str,
    ) -> Result<String> {
        use solana_sdk::signature::Keypair;
        use solana_sdk::signer::Signer;
        use solana_sdk::system_instruction;
        use solana_sdk::transaction::Transaction;
        use solana_sdk::pubkey::Pubkey;
        use std::str::FromStr;

        let payer = Keypair::from_bytes(keypair_bytes)
            .map_err(|e| anyhow::anyhow!("Invalid fee payer keypair: {}", e))?;

        let tip_account = Pubkey::from_str(tip_account_str)
            .map_err(|e| anyhow::anyhow!("Invalid tip account: {}", e))?;

        let transfer_ix = system_instruction::transfer(
            &payer.pubkey(),
            &tip_account,
            tip_lamports,
        );

        // Get recent blockhash
        let blockhash = self.get_recent_blockhash().await?;
        let blockhash = solana_sdk::hash::Hash::from_str(&blockhash)
            .map_err(|e| anyhow::anyhow!("Invalid blockhash: {}", e))?;

        let tx = Transaction::new_signed_with_payer(
            &[transfer_ix],
            Some(&payer.pubkey()),
            &[&payer],
            blockhash,
        );

        let tx_bytes = bincode::serialize(&tx)?;
        Ok(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD, &tx_bytes,
        ))
    }

    /// Get recent blockhash from RPC for tip transaction.
    async fn get_recent_blockhash(&self) -> Result<String> {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getLatestBlockhash",
            "params": [{"commitment": "finalized"}]
        });

        let resp: serde_json::Value = self.http_client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;

        resp["result"]["value"]["blockhash"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow::anyhow!("Failed to get blockhash"))
    }

    /// Poll Jito getBundleStatuses until landed or timeout.
    /// Returns the slot number if landed, None if timed out.
    async fn poll_bundle_status(&self, bundle_id: &str, max_secs: u64) -> Option<u64> {
        let start = std::time::Instant::now();
        let poll_interval = std::time::Duration::from_millis(500);

        while start.elapsed().as_secs() < max_secs {
            tokio::time::sleep(poll_interval).await;

            match self.jito_client.get_bundle_status(bundle_id).await {
                Ok(resp) => {
                    // Response: { "result": { "value": [{ "bundle_id", "status", "slot" }] } }
                    if let Some(statuses) = resp["result"]["value"].as_array() {
                        for status in statuses {
                            let st = status["confirmation_status"].as_str().unwrap_or("");
                            if st == "confirmed" || st == "finalized" {
                                let slot = status["slot"].as_u64();
                                tracing::info!(
                                    "Bundle {} CONFIRMED at slot {:?} ({:.0}ms)",
                                    bundle_id,
                                    slot,
                                    start.elapsed().as_millis(),
                                );
                                return slot;
                            }
                            if st == "failed" {
                                tracing::warn!("Bundle {} FAILED on-chain", bundle_id);
                                return None;
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::debug!("Bundle status poll error: {}", e);
                }
            }
        }

        tracing::warn!(
            "Bundle {} not confirmed within {}s",
            bundle_id, max_secs,
        );
        None
    }

    /// Pre-flight simulation: send the swap TX to RPC simulateTransaction
    /// to check CU consumption BEFORE spending Jito tip.
    /// Rejects if CU > 1,000,000 (likely a malicious TransferHook CU-drain).
    async fn preflight_simulate(&self, tx_base64: &str) -> Result<()> {
        const MAX_CU: u64 = 1_000_000;

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "simulateTransaction",
            "params": [
                tx_base64,
                {
                    "encoding": "base64",
                    "sigVerify": false,
                    "replaceRecentBlockhash": true
                }
            ]
        });

        let resp: serde_json::Value = self.http_client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;

        // Check simulation error
        if let Some(err) = resp["result"]["value"]["err"].as_object() {
            // InstructionError is expected sometimes (e.g. insufficient balance in simulation)
            // but "ComputationalBudgetExceeded" means CU-drain
            let err_str = serde_json::to_string(err).unwrap_or_default();
            if err_str.contains("ComputationalBudgetExceeded") {
                anyhow::bail!("Simulation failed: CU budget exceeded — likely CU-drain hook");
            }
        }

        // Check CU consumed
        if let Some(cu) = resp["result"]["value"]["unitsConsumed"].as_u64() {
            if cu > MAX_CU {
                anyhow::bail!(
                    "Abnormal CU consumption: {} (max: {}) — possible CU-drain hook",
                    cu, MAX_CU,
                );
            }
            tracing::debug!("Pre-flight CU: {}", cu);
        }

        Ok(())
    }

    pub fn jito_client(&self) -> &JitoClient {
        &self.jito_client
    }

    async fn submit_via_rpc_endpoint(&self, tx_base64: &str, rpc_url: &str) -> Result<String> {
        // skipPreflight is configurable via `with_skip_preflight()` (Audit #43).
        // When true (default), errors won't be caught before on-chain execution but submission
        // is faster. When false, the RPC node runs preflight simulation, adding latency but
        // catching obvious failures early.
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendTransaction",
            "params": [tx_base64, {"encoding": "base64", "skipPreflight": self.skip_preflight}]
        });

        let resp: serde_json::Value = self.http_client
            .post(rpc_url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;

        if let Some(error) = resp.get("error") {
            anyhow::bail!("RPC sendTransaction error: {}", error);
        }

        // A well-formed JSON-RPC success response MUST carry a `result` field.
        // If it is missing or not a string, treat that as a failure rather
        // than propagating an empty-string "signature" upstream (which the
        // runner / caller would otherwise log and persist as a successful
        // submission). (Audit: silent fake-success.)
        match resp.get("result").and_then(|v| v.as_str()) {
            Some(sig) if !sig.is_empty() => Ok(sig.to_string()),
            _ => anyhow::bail!(
                "RPC sendTransaction returned no signature: {}",
                resp
            ),
        }
    }
}
