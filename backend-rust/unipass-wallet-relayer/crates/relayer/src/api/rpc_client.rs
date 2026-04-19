//! Shared RPC helper: map chainId → provider.
use ethers::providers::{Http, Provider};
use std::sync::Arc;

/// Map a supported chainId to the configured RPC URL.
pub fn rpc_url_for_chain(cfg: &configs::RelayerConfig, chain_id: u64) -> Option<&str> {
    let url = match chain_id {
        1 => cfg.ethereum_rpc_url.as_str(),
        56 => cfg.bsc_rpc_url.as_str(),
        137 => cfg.polygon_rpc_url.as_str(),
        42161 => cfg.arbitrum_rpc_url.as_str(),
        _ => return None,
    };
    if url.is_empty() {
        None
    } else {
        Some(url)
    }
}

/// Build an ethers HTTP provider for the given chain.
pub fn provider_for_chain(
    cfg: &configs::RelayerConfig,
    chain_id: u64,
) -> anyhow::Result<Arc<Provider<Http>>> {
    let url = rpc_url_for_chain(cfg, chain_id)
        .ok_or_else(|| anyhow::anyhow!("unsupported or unconfigured chainId: {}", chain_id))?;
    let provider = Provider::<Http>::try_from(url)
        .map_err(|e| anyhow::anyhow!("invalid rpc url for chain {}: {}", chain_id, e))?;
    Ok(Arc::new(provider))
}
