use std::collections::HashMap;

/// Multi-chain transaction submitter registry
pub struct TransactionSubmitters {
    rpc_urls: HashMap<u64, String>,
}

impl TransactionSubmitters {
    pub fn new() -> Self {
        Self { rpc_urls: HashMap::new() }
    }

    pub fn add_chain(&mut self, chain_id: u64, rpc_url: &str) {
        self.rpc_urls.insert(chain_id, rpc_url.to_string());
    }

    pub fn get_rpc_url(&self, chain_id: u64) -> Option<&str> {
        self.rpc_urls.get(&chain_id).map(|s| s.as_str())
    }
}
