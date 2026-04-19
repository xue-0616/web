use anyhow::Result;

/// Watch CKB blockchain for new blocks and extract farming-related transactions.
///
/// BUG-29 FIX: `last_block` now defaults to `None` (uninitialized). On first
/// `poll()`, it fetches the current chain tip and starts watching from there,
/// instead of starting from block 0 which would attempt to process millions
/// of historical blocks, causing OOM or extremely slow startup.
pub struct BlockWatcher {
    ckb_rpc_url: String,
    last_block: Option<u64>,
}

impl BlockWatcher {
    pub fn new(ckb_rpc_url: &str) -> Self {
        Self { ckb_rpc_url: ckb_rpc_url.to_string(), last_block: None }
    }

    /// Create a BlockWatcher that resumes from a specific block number.
    /// Useful for restoring state from a database checkpoint.
    pub fn with_start_block(ckb_rpc_url: &str, start_block: u64) -> Self {
        Self { ckb_rpc_url: ckb_rpc_url.to_string(), last_block: Some(start_block) }
    }

    /// Poll for new blocks since last check.
    /// On the very first call, initializes to the current chain tip
    /// (returns empty vec) to avoid processing the entire blockchain history.
    pub async fn poll(&mut self) -> Result<Vec<u64>> {
        let client = reqwest::Client::new();
        let resp: serde_json::Value = client.post(&self.ckb_rpc_url)
            .json(&serde_json::json!({"jsonrpc":"2.0","id":1,"method":"get_tip_block_number","params":[]}))
            .send().await?.json().await?;

        let tip: u64 = u64::from_str_radix(
            resp["result"].as_str().unwrap_or("0x0").trim_start_matches("0x"), 16
        ).unwrap_or(0);

        match self.last_block {
            Some(last) => {
                let new_blocks: Vec<u64> = ((last + 1)..=tip).collect();
                self.last_block = Some(tip);
                Ok(new_blocks)
            }
            None => {
                // First poll: initialize to current tip, return no blocks
                // This prevents attempting to process entire chain history
                tracing::info!(
                    "BlockWatcher initialized at chain tip block {}",
                    tip
                );
                self.last_block = Some(tip);
                Ok(Vec::new())
            }
        }
    }

    /// Get the last processed block number, if any.
    pub fn last_block(&self) -> Option<u64> {
        self.last_block
    }
}
