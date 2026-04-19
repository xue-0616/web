/// Monitor utility functions

pub fn block_range_chunks(from: u64, to: u64, chunk_size: u64) -> Vec<(u64, u64)> {
    let mut ranges = Vec::new();
    let mut start = from;
    while start <= to {
        let end = std::cmp::min(start + chunk_size - 1, to);
        ranges.push((start, end));
        start = end + 1;
    }
    ranges
}
