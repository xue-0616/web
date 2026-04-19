//! State types persisted to `./{store_dir}/{source_addr:x}.json`.
//!
//! # Typo is intentional
//!
//! The closed-source ELF has a symbol `AriDropInfo` — note `Ari`, not
//! `Air`. We preserve the typo so that state files produced by the
//! old binary deserialise unchanged against this rewrite.

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// Top-level per-NFT-contract state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AirDrop {
    /// Source NFT contract we watch for `SetSource` events.
    pub source: Address,
    /// Highest block we've already processed.
    pub last_processed_block: u64,
    /// Tx currently awaiting receipt (at most one per source).
    #[serde(default)]
    pub pending_tx: Option<PendingTx>,
    /// All historical airdrops we've made for this source.
    #[serde(default)]
    pub airdrops: Vec<AriDropInfo>,
}

impl AirDrop {
    pub fn new(source: Address, from_block: u64) -> Self {
        Self {
            source,
            last_processed_block: from_block,
            pending_tx: None,
            airdrops: Vec::new(),
        }
    }

    /// Every receiver this `AirDrop` has already minted to, across all
    /// completed `airdrops` AND the in-flight `pending_tx`. Used by
    /// [`crate::dedup`] to avoid double-mints.
    pub fn known_receivers(&self) -> std::collections::BTreeSet<Address> {
        let mut out = std::collections::BTreeSet::new();
        for info in &self.airdrops {
            for r in &info.receivers {
                out.insert(*r);
            }
        }
        if let Some(p) = &self.pending_tx {
            for r in &p.addresses {
                out.insert(*r);
            }
        }
        out
    }
}

/// In-flight transaction state.
///
/// The ELF has fields `block`, `addresses`, `address` — the singular
/// `address` is the tx hash target (receiver-of-state) of the
/// on-chain `SetSource` that trigered this pending mint; the plural
/// `addresses` are the airdrop receivers captured from the event.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PendingTx {
    pub block: u64,
    pub addresses: Vec<Address>,
    pub address: Address,
    /// Our own mint tx hash, `None` until we've actually broadcast.
    #[serde(default)]
    pub tx_hash: Option<H256>,
}

/// Historical completed airdrop record. Field names reproduced from the
/// ELF's serde visitor (`deploy_block_number`, `deploy_tx_hash`,
/// `airdrop_tx_hash`). The three extra inferred fields (`source_address`,
/// `token_id`, `receivers`) are the minimum needed to reconstruct the
/// on-chain effect for audit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[allow(clippy::module_name_repetitions)]
pub struct AriDropInfo {
    pub deploy_block_number: u64,
    pub deploy_tx_hash: H256,
    pub airdrop_tx_hash: Option<H256>,
    pub source_address: Address,
    #[serde(default)]
    pub token_id: Option<U256>,
    pub receivers: Vec<Address>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::H160;

    fn addr(n: u8) -> Address { H160::from_low_u64_be(n as u64) }

    #[test]
    fn known_receivers_includes_historical_and_pending() {
        let mut ad = AirDrop::new(addr(1), 100);
        ad.airdrops.push(AriDropInfo {
            deploy_block_number: 101,
            deploy_tx_hash: H256::zero(),
            airdrop_tx_hash: None,
            source_address: addr(1),
            token_id: None,
            receivers: vec![addr(10), addr(11)],
        });
        ad.pending_tx = Some(PendingTx {
            block: 102,
            addresses: vec![addr(12)],
            address: addr(1),
            tx_hash: None,
        });
        let seen = ad.known_receivers();
        assert!(seen.contains(&addr(10)));
        assert!(seen.contains(&addr(11)));
        assert!(seen.contains(&addr(12)));
        assert_eq!(seen.len(), 3);
    }

    #[test]
    fn known_receivers_empty_state() {
        let ad = AirDrop::new(addr(1), 0);
        assert!(ad.known_receivers().is_empty());
    }

    #[test]
    fn serde_roundtrip_preserves_typo() {
        let a = AriDropInfo {
            deploy_block_number: 7,
            deploy_tx_hash: H256::zero(),
            airdrop_tx_hash: Some(H256::from_low_u64_be(1)),
            source_address: addr(9),
            token_id: Some(U256::from(42)),
            receivers: vec![addr(1)],
        };
        let s = serde_json::to_string(&a).unwrap();
        // The typo-preserving serde name is the struct's JSON shape —
        // field names are lower_snake_case inherited from the original.
        assert!(s.contains("deploy_block_number"));
        assert!(s.contains("airdrop_tx_hash"));
        let back: AriDropInfo = serde_json::from_str(&s).unwrap();
        assert_eq!(back, a);
    }

    #[test]
    fn pending_tx_json_shape() {
        let p = PendingTx {
            block: 42,
            addresses: vec![addr(7)],
            address: addr(8),
            tx_hash: None,
        };
        let s = serde_json::to_string(&p).unwrap();
        // The ELF's recovered field set: block, addresses, address.
        assert!(s.contains("\"block\":42"));
        assert!(s.contains("\"addresses\""));
        assert!(s.contains("\"address\""));
    }
}
