//! Receiver deduplication.
//!
//! The ELF logs `"Got Duplicate address: 0x{addr}"` when the incoming
//! event references a receiver it has already airdropped to for that
//! source. This module is a pure filter over `(known_set, candidates)
//! → new_candidates`.

use std::collections::BTreeSet;

use ethers::types::Address;

/// Return the subset of `candidates` that is NOT present in `seen`,
/// **with stable order** (the original order in `candidates`) and
/// **with intra-batch duplicates removed**.
///
/// The ELF warns about intra-batch dupes with the same log line so we
/// collapse them too — this is the behaviour that matters for gas
/// cost (we don't want to mint to the same receiver twice in one tx).
pub fn filter_new(seen: &BTreeSet<Address>, candidates: &[Address]) -> (Vec<Address>, Vec<Address>) {
    let mut out = Vec::with_capacity(candidates.len());
    let mut dupes = Vec::new();
    let mut in_batch: BTreeSet<Address> = BTreeSet::new();
    for a in candidates {
        if seen.contains(a) || !in_batch.insert(*a) {
            dupes.push(*a);
        } else {
            out.push(*a);
        }
    }
    (out, dupes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::H160;

    fn a(n: u8) -> Address { H160::from_low_u64_be(n as u64) }

    #[test]
    fn no_seen_no_dupes_passthrough() {
        let seen = BTreeSet::new();
        let cands = vec![a(1), a(2), a(3)];
        let (new, dup) = filter_new(&seen, &cands);
        assert_eq!(new, cands);
        assert!(dup.is_empty());
    }

    #[test]
    fn removes_already_seen() {
        let seen: BTreeSet<_> = [a(2)].into_iter().collect();
        let (new, dup) = filter_new(&seen, &[a(1), a(2), a(3)]);
        assert_eq!(new, vec![a(1), a(3)]);
        assert_eq!(dup, vec![a(2)]);
    }

    #[test]
    fn removes_intra_batch_duplicates() {
        let seen = BTreeSet::new();
        let (new, dup) = filter_new(&seen, &[a(1), a(1), a(2), a(1)]);
        assert_eq!(new, vec![a(1), a(2)]);
        assert_eq!(dup, vec![a(1), a(1)]);
    }

    #[test]
    fn preserves_first_occurrence_order() {
        let seen = BTreeSet::new();
        let (new, _) = filter_new(&seen, &[a(3), a(1), a(2), a(1), a(3)]);
        assert_eq!(new, vec![a(3), a(1), a(2)]);
    }

    #[test]
    fn empty_candidates_returns_empty() {
        let seen: BTreeSet<_> = [a(1)].into_iter().collect();
        let (new, dup) = filter_new(&seen, &[]);
        assert!(new.is_empty());
        assert!(dup.is_empty());
    }

    #[test]
    fn all_seen_returns_empty_new() {
        let seen: BTreeSet<_> = [a(1), a(2)].into_iter().collect();
        let (new, dup) = filter_new(&seen, &[a(1), a(2)]);
        assert!(new.is_empty());
        assert_eq!(dup, vec![a(1), a(2)]);
    }
}
