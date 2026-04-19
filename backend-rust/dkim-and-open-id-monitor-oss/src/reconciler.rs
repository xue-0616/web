//! Core diff logic.

use std::collections::BTreeMap;

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DiffEntry {
    pub key: String,
    pub live_fingerprint: Option<String>,
    pub chain_fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ReconReport {
    pub missing_on_chain: Vec<DiffEntry>,
    pub stale_on_chain: Vec<DiffEntry>,
    pub ok: Vec<String>,
}

impl ReconReport {
    pub fn is_alerting(&self) -> bool {
        !self.missing_on_chain.is_empty() || !self.stale_on_chain.is_empty()
    }
    pub fn summary(&self) -> String {
        format!(
            "missing_on_chain={} stale_on_chain={} ok={}",
            self.missing_on_chain.len(),
            self.stale_on_chain.len(),
            self.ok.len()
        )
    }
}

pub fn reconcile(
    live: &BTreeMap<String, String>,
    chain: &BTreeMap<String, String>,
) -> ReconReport {
    let mut missing_on_chain = Vec::new();
    let mut stale_on_chain = Vec::new();
    let mut ok = Vec::new();
    for (key, live_fp) in live {
        match chain.get(key) {
            Some(cfp) if cfp == live_fp => ok.push(key.clone()),
            Some(cfp) => stale_on_chain.push(DiffEntry {
                key: key.clone(),
                live_fingerprint: Some(live_fp.clone()),
                chain_fingerprint: Some(cfp.clone()),
            }),
            None => missing_on_chain.push(DiffEntry {
                key: key.clone(),
                live_fingerprint: Some(live_fp.clone()),
                chain_fingerprint: None,
            }),
        }
    }
    ReconReport { missing_on_chain, stale_on_chain, ok }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn m(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn all_match_is_not_alerting() {
        let live = m(&[("a", "0x1"), ("b", "0x2")]);
        let chain = m(&[("a", "0x1"), ("b", "0x2")]);
        let r = reconcile(&live, &chain);
        assert_eq!(r.ok.len(), 2);
        assert!(!r.is_alerting());
    }

    #[test]
    fn missing_on_chain_is_alerting() {
        let live = m(&[("a", "0x1"), ("b", "0x2")]);
        let chain = m(&[("a", "0x1")]);
        let r = reconcile(&live, &chain);
        assert_eq!(r.ok.len(), 1);
        assert_eq!(r.missing_on_chain.len(), 1);
        assert_eq!(r.missing_on_chain[0].key, "b");
        assert_eq!(r.missing_on_chain[0].chain_fingerprint, None);
        assert!(r.is_alerting());
    }

    #[test]
    fn stale_on_chain_is_alerting() {
        let live = m(&[("a", "0xNEW")]);
        let chain = m(&[("a", "0xOLD")]);
        let r = reconcile(&live, &chain);
        assert_eq!(r.stale_on_chain.len(), 1);
        assert_eq!(r.stale_on_chain[0].live_fingerprint.as_deref(), Some("0xNEW"));
        assert_eq!(r.stale_on_chain[0].chain_fingerprint.as_deref(), Some("0xOLD"));
        assert!(r.is_alerting());
    }

    #[test]
    fn chain_has_extra_entries_is_not_alerting() {
        // A fingerprint present on-chain but absent from live feeds is
        // NOT an alert — it's a revoked-but-not-cleared historical key.
        let live = m(&[("a", "0x1")]);
        let chain = m(&[("a", "0x1"), ("old", "0xzzz")]);
        let r = reconcile(&live, &chain);
        assert!(!r.is_alerting());
        assert_eq!(r.ok, vec!["a".to_string()]);
    }

    #[test]
    fn empty_live_is_not_alerting() {
        let r = reconcile(&BTreeMap::new(), &m(&[("a", "0x1")]));
        assert!(!r.is_alerting());
    }

    #[test]
    fn summary_formats_counts() {
        let live = m(&[("a", "0xNEW"), ("b", "0x2")]);
        let chain = m(&[("a", "0xOLD")]);
        let r = reconcile(&live, &chain);
        assert_eq!(r.summary(), "missing_on_chain=1 stale_on_chain=1 ok=0");
    }
}
