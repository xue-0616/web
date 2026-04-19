//! On-chain log types for `DkimKeysLog` and `OpenIdKeysLog`.
//!
//! The closed-source ELF has rodata strings
//!   * `Unknown Event Topic: parse_log`
//!   * `src/open_id_keys_log_parser.rs`
//!   * `src/dkim_keys_log_parser.rs` (inferred)
//!
//! Each log entry registers (or revokes) a fingerprint. The monitor
//! compares this set to what DNS/OIDC currently serve; if a live
//! fingerprint isn't in the chain set, that's a rotation the on-chain
//! contract hasn't caught up with → Slack alert.
//!
//! This module is **data-only** — pure decoding + comparison. The
//! actual `eth_getLogs` call is delegated to a [`ChainLogReader`] trait
//! so tests can inject canned entries deterministically.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

/// One entry registered on-chain. `kind` distinguishes DKIM vs OpenID.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChainLogEntry {
    pub kind: LogKind,
    /// For DKIM: `domain|selector`. For OpenID: `iss|kid`.
    pub key: String,
    /// `keccak256(public_key_material)` (0x-prefixed hex).
    pub fingerprint: String,
    /// Block number the log was emitted at.
    pub block: u64,
    /// `true` if the log is a revocation (fingerprint cleared).
    pub revoked: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LogKind {
    Dkim,
    OpenId,
}

#[async_trait]
pub trait ChainLogReader: Send + Sync + 'static {
    /// Return all entries of `kind` up to and including `at_or_before_block`.
    async fn logs_up_to(
        &self,
        kind: LogKind,
        at_or_before_block: u64,
    ) -> Result<Vec<ChainLogEntry>>;

    async fn latest_block(&self) -> Result<u64>;
}

/// Collapse the raw log stream into a dedup'd "current state" map keyed
/// by `key` — the latest (highest-block) entry wins. Revocations are
/// applied by removing the key.
pub fn current_set(entries: &[ChainLogEntry]) -> std::collections::BTreeMap<String, String> {
    let mut sorted = entries.to_vec();
    sorted.sort_by_key(|e| e.block);
    let mut out = std::collections::BTreeMap::new();
    for e in sorted {
        if e.revoked {
            out.remove(&e.key);
        } else {
            out.insert(e.key, e.fingerprint);
        }
    }
    out
}

// ------------------------------------------------------------------
// Stub / test implementation
// ------------------------------------------------------------------

#[derive(Debug, Default, Clone)]
pub struct StubChainReader {
    pub entries: Vec<ChainLogEntry>,
    pub latest: u64,
}

#[async_trait]
impl ChainLogReader for StubChainReader {
    async fn logs_up_to(
        &self,
        kind: LogKind,
        at_or_before_block: u64,
    ) -> Result<Vec<ChainLogEntry>> {
        Ok(self
            .entries
            .iter()
            .filter(|e| e.kind == kind && e.block <= at_or_before_block)
            .cloned()
            .collect())
    }

    async fn latest_block(&self) -> Result<u64> {
        Ok(self.latest)
    }
}

// ------------------------------------------------------------------
// Sync check
// ------------------------------------------------------------------

/// Is `latest_block` recent enough that we trust the chain view?
///
/// The ELF's `check_chain_sync` config flag enables a guard that refuses
/// to act when the RPC node reports a latest block older than `max_lag`
/// blocks behind "now". We can't know "now" without a second reference,
/// so we simply check that the latest block is >= the highest block we
/// have entries for (i.e. the node hasn't gone backwards / lost data).
pub fn chain_is_consistent(entries: &[ChainLogEntry], latest_block: u64) -> Result<()> {
    if let Some(highest_entry_block) = entries.iter().map(|e| e.block).max() {
        if latest_block < highest_entry_block {
            return Err(Error::Chain(format!(
                "node rewound: latest={latest_block} < seen={highest_entry_block}"
            )));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk(kind: LogKind, key: &str, fp: &str, block: u64, revoked: bool) -> ChainLogEntry {
        ChainLogEntry {
            kind, key: key.into(), fingerprint: fp.into(), block, revoked,
        }
    }

    #[test]
    fn current_set_takes_latest_block_wins() {
        let entries = vec![
            mk(LogKind::Dkim, "gmail.com|20230601", "0xaa", 100, false),
            mk(LogKind::Dkim, "gmail.com|20230601", "0xbb", 200, false),
        ];
        let s = current_set(&entries);
        assert_eq!(s["gmail.com|20230601"], "0xbb");
    }

    #[test]
    fn current_set_honours_revocation() {
        let entries = vec![
            mk(LogKind::Dkim, "k", "0xaa", 100, false),
            mk(LogKind::Dkim, "k", "0xaa", 200, true),
        ];
        assert!(current_set(&entries).is_empty());
    }

    #[test]
    fn current_set_reregister_after_revoke() {
        let entries = vec![
            mk(LogKind::Dkim, "k", "0xaa", 100, false),
            mk(LogKind::Dkim, "k", "0xaa", 200, true),
            mk(LogKind::Dkim, "k", "0xcc", 300, false),
        ];
        assert_eq!(current_set(&entries)["k"], "0xcc");
    }

    #[test]
    fn current_set_independent_of_input_order() {
        let e1 = mk(LogKind::OpenId, "iss|kid", "0xaa", 200, false);
        let e2 = mk(LogKind::OpenId, "iss|kid", "0xbb", 100, false);
        // Note: block 200 is newer → 0xaa wins regardless of order.
        let s1 = current_set(&[e1.clone(), e2.clone()]);
        let s2 = current_set(&[e2, e1]);
        assert_eq!(s1, s2);
        assert_eq!(s1["iss|kid"], "0xaa");
    }

    #[tokio::test]
    async fn stub_reader_filters_by_kind_and_block() {
        let reader = StubChainReader {
            entries: vec![
                mk(LogKind::Dkim, "a", "0x1", 10, false),
                mk(LogKind::OpenId, "b", "0x2", 20, false),
                mk(LogKind::Dkim, "c", "0x3", 30, false),
            ],
            latest: 50,
        };
        let dkim = reader.logs_up_to(LogKind::Dkim, 25).await.unwrap();
        assert_eq!(dkim.len(), 1);
        assert_eq!(dkim[0].key, "a");
        assert_eq!(reader.latest_block().await.unwrap(), 50);
    }

    #[test]
    fn chain_is_consistent_when_latest_is_ge_max_seen() {
        let entries = vec![mk(LogKind::Dkim, "a", "0x1", 100, false)];
        assert!(chain_is_consistent(&entries, 100).is_ok());
        assert!(chain_is_consistent(&entries, 200).is_ok());
        assert!(chain_is_consistent(&[], 0).is_ok());
    }

    #[test]
    fn chain_is_inconsistent_when_node_rewound() {
        let entries = vec![mk(LogKind::Dkim, "a", "0x1", 100, false)];
        let err = chain_is_consistent(&entries, 50).unwrap_err();
        assert!(matches!(err, Error::Chain(_)));
    }
}
