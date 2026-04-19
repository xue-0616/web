//! Paginated block-range iterator.
//!
//! The ELF's main loop logs `"Start to Get Logs from_block=X to_block=Y"`
//! and `"To Block: Y"` — it paginates over large block windows because
//! public RPC nodes cap `eth_getLogs` to a small range (1-10k blocks).
//!
//! This module yields those paginated ranges as `(from, to)` pairs,
//! fully closed on both ends.

use crate::error::Error;

/// Return the list of closed `(from, to)` ranges covering
/// `[start, end]` with step `max_span`. `end < start` → empty.
pub fn paginate(start: u64, end: u64, max_span: u64) -> Vec<(u64, u64)> {
    if end < start || max_span == 0 {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut from = start;
    while from <= end {
        // Saturating add so we don't wrap at u64::MAX.
        let to = from.saturating_add(max_span.saturating_sub(1)).min(end);
        out.push((from, to));
        if to == end { break; }
        from = to + 1;
    }
    out
}

/// Given `last_processed_block` (highest block we've already handled),
/// compute the next `from_block` to scan. Always `last + 1` — with
/// guard against u64 overflow.
pub fn next_from(last_processed_block: u64) -> Result<u64, Error> {
    last_processed_block
        .checked_add(1)
        .ok_or_else(|| Error::Internal("last_processed_block overflowed u64".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_range_when_span_covers_all() {
        assert_eq!(paginate(100, 200, 1000), vec![(100, 200)]);
    }

    #[test]
    fn splits_evenly_on_boundary() {
        let r = paginate(0, 999, 500);
        assert_eq!(r, vec![(0, 499), (500, 999)]);
    }

    #[test]
    fn splits_with_trailing_remainder() {
        let r = paginate(0, 1001, 500);
        assert_eq!(r, vec![(0, 499), (500, 999), (1000, 1001)]);
    }

    #[test]
    fn empty_when_end_before_start() {
        assert!(paginate(100, 99, 1000).is_empty());
    }

    #[test]
    fn empty_when_span_is_zero() {
        assert!(paginate(0, 100, 0).is_empty());
    }

    #[test]
    fn single_block_window() {
        assert_eq!(paginate(42, 42, 1000), vec![(42, 42)]);
    }

    #[test]
    fn handles_large_numbers_without_overflow() {
        let r = paginate(u64::MAX - 10, u64::MAX - 1, 5);
        assert_eq!(r.len(), 2);
        assert_eq!(r[0], (u64::MAX - 10, u64::MAX - 6));
        assert_eq!(r[1], (u64::MAX - 5, u64::MAX - 1));
    }

    #[test]
    fn ranges_are_contiguous_and_nonoverlapping() {
        let r = paginate(0, 10_000, 777);
        for w in r.windows(2) {
            assert_eq!(w[0].1 + 1, w[1].0, "gap or overlap between ranges");
        }
    }

    #[test]
    fn next_from_increments() {
        assert_eq!(next_from(41).unwrap(), 42);
    }

    #[test]
    fn next_from_overflow_is_error() {
        assert!(next_from(u64::MAX).is_err());
    }
}
