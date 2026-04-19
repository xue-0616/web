/// Parse revert reasons from EVM transaction errors
pub fn parse_revert_reason(data: &[u8]) -> Option<String> {
    if data.len() < 4 { return None; }
    // Error(string) selector: 0x08c379a0
    if data[..4] == [0x08, 0xc3, 0x79, 0xa0] && data.len() >= 68 {
        let offset = u64::from_be_bytes([0, 0, 0, 0, data[4], data[5], data[6], data[7]]) as usize;
        let len_start = 4 + offset;
        if data.len() > len_start + 32 {
            let len = u64::from_be_bytes([0,0,0,0, data[len_start+28], data[len_start+29], data[len_start+30], data[len_start+31]]) as usize;
            let str_start = len_start + 32;
            if data.len() >= str_start + len {
                return String::from_utf8(data[str_start..str_start+len].to_vec()).ok();
            }
        }
    }
    None
}
