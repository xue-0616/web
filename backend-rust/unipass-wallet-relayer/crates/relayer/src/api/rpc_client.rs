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

#[cfg(test)]
mod tests {
    //! HIGH-RL-1 regression tests. The four RPC handlers (nonce,
    //! meta_nonce, receipt, simulate) all dispatch through this
    //! helper. A silent typo in one of the supported chain IDs
    //! would cause some wallets to receive random-garbage responses
    //! and others to lose service without any alert firing, so we
    //! lock the mapping down here.
    use super::*;

    fn cfg_with(
        eth: &str,
        bsc: &str,
        poly: &str,
        arb: &str,
    ) -> configs::RelayerConfig {
        configs::RelayerConfig {
            ethereum_rpc_url: eth.to_string(),
            bsc_rpc_url: bsc.to_string(),
            polygon_rpc_url: poly.to_string(),
            arbitrum_rpc_url: arb.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn maps_each_supported_chain_to_its_own_url() {
        let cfg = cfg_with(
            "http://eth.example",
            "http://bsc.example",
            "http://poly.example",
            "http://arb.example",
        );
        assert_eq!(rpc_url_for_chain(&cfg, 1), Some("http://eth.example"));
        assert_eq!(rpc_url_for_chain(&cfg, 56), Some("http://bsc.example"));
        assert_eq!(rpc_url_for_chain(&cfg, 137), Some("http://poly.example"));
        assert_eq!(rpc_url_for_chain(&cfg, 42161), Some("http://arb.example"));
    }

    #[test]
    fn unknown_chain_returns_none() {
        let cfg = cfg_with("x", "x", "x", "x");
        // Goerli (5) and Sepolia (11155111) aren't configured. Do NOT
        // silently fall back to mainnet — the caller has to surface
        // "unsupported chain" so the client doesn't broadcast to the
        // wrong network.
        assert_eq!(rpc_url_for_chain(&cfg, 5), None);
        assert_eq!(rpc_url_for_chain(&cfg, 11155111), None);
        assert_eq!(rpc_url_for_chain(&cfg, 999_999), None);
    }

    #[test]
    fn empty_url_is_treated_as_unconfigured() {
        // Deploying with an unset env var leaves the field as "" via
        // envy's default-derive. We must treat that as "this chain
        // isn't available here" rather than handing an empty URL to
        // ethers and getting an obscure panic later.
        let cfg = cfg_with("", "http://bsc.example", "", "");
        assert_eq!(rpc_url_for_chain(&cfg, 1), None);
        assert_eq!(rpc_url_for_chain(&cfg, 56), Some("http://bsc.example"));
        assert_eq!(rpc_url_for_chain(&cfg, 137), None);
        assert_eq!(rpc_url_for_chain(&cfg, 42161), None);
    }

    #[test]
    fn provider_builder_rejects_invalid_url() {
        let cfg = cfg_with("not-a-url", "", "", "");
        let err = provider_for_chain(&cfg, 1).unwrap_err();
        assert!(err.to_string().contains("invalid rpc url"));
    }

    #[test]
    fn provider_builder_rejects_unsupported_chain() {
        let cfg = cfg_with("http://eth.example", "", "", "");
        let err = provider_for_chain(&cfg, 5).unwrap_err();
        assert!(err.to_string().contains("unsupported or unconfigured"));
    }
}
