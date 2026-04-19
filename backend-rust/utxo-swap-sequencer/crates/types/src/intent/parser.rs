use super::*;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("Invalid intent data length: {0}")]
    InvalidLength(usize),
    #[error("Invalid intent type: {0}")]
    InvalidIntentType(u8),
    #[error("Invalid swap direction: {0}")]
    InvalidSwapDirection(u8),
    #[error("Missing required field: {0}")]
    MissingField(&'static str),
    #[error("Invalid type hash")]
    InvalidTypeHash,
}

/// Parse intent from CKB cell data
///
/// Intent cell data layout (molecule serialized):
/// - intent_type: u8
/// - pool_type_hash: [u8; 32]
/// - asset_x_type_hash: [u8; 32]
/// - asset_y_type_hash: [u8; 32]
/// - swap_type: u8 (optional, for swap intents)
/// - amount_in: u128 (little-endian)
/// - min_amount_out: u128 (little-endian)
/// - user_lock: Script (molecule encoded)
pub fn parse_intent(data: &[u8]) -> Result<ParsedIntent, ParseError> {
    if data.len() < 113 {
        return Err(ParseError::InvalidLength(data.len()));
    }

    let intent_type = match data[0] {
        0 => IntentType::SwapExactInputForOutput,
        1 => IntentType::SwapInputForExactOutput,
        2 => IntentType::AddLiquidity,
        3 => IntentType::RemoveLiquidity,
        other => return Err(ParseError::InvalidIntentType(other)),
    };

    let mut pool_type_hash = [0u8; 32];
    pool_type_hash.copy_from_slice(&data[1..33]);

    let mut asset_x_type_hash = [0u8; 32];
    asset_x_type_hash.copy_from_slice(&data[33..65]);

    let mut asset_y_type_hash = [0u8; 32];
    asset_y_type_hash.copy_from_slice(&data[65..97]);

    let swap_type = match intent_type {
        IntentType::SwapExactInputForOutput | IntentType::SwapInputForExactOutput => {
            Some(match data[97] {
                0 => SwapDirection::XToY,
                1 => SwapDirection::YToX,
                other => return Err(ParseError::InvalidSwapDirection(other)),
            })
        }
        _ => None,
    };

    let offset = if swap_type.is_some() { 98 } else { 97 };

    let amount_in = u128::from_le_bytes(
        data[offset..offset + 16]
            .try_into()
            .map_err(|_| ParseError::InvalidLength(data.len()))?,
    );

    let min_amount_out = u128::from_le_bytes(
        data[offset + 16..offset + 32]
            .try_into()
            .map_err(|_| ParseError::InvalidLength(data.len()))?,
    );

    // Parse user lock script from remaining bytes
    let lock_data = &data[offset + 32..];
    let user_lock = parse_script(lock_data)?;

    Ok(ParsedIntent {
        intent_type,
        pool_type_hash,
        asset_x_type_hash,
        asset_y_type_hash,
        // BL-C1: type_script args are populated later from on-chain cell metadata
        // (in manager.rs) since they are not part of the intent cell data layout.
        asset_x_type_args: Vec::new(),
        asset_y_type_args: Vec::new(),
        swap_type,
        amount_in,
        min_amount_out,
        user_lock,
    })
}

/// Parse CKB Script from molecule-encoded bytes
fn parse_script(data: &[u8]) -> Result<CkbScript, ParseError> {
    if data.len() < 53 {
        return Err(ParseError::InvalidLength(data.len()));
    }

    // Molecule table: total_size(4) + offset_code_hash(4) + offset_hash_type(4) + offset_args(4)
    // code_hash(32) + hash_type(1) + args_length(4) + args(variable)
    let total_size = u32::from_le_bytes(
        data[0..4]
            .try_into()
            .map_err(|_| ParseError::MissingField("script total_size"))?,
    ) as usize;

    if data.len() < total_size {
        return Err(ParseError::InvalidLength(data.len()));
    }

    // Skip molecule header (16 bytes for 3 fields)
    let header_size = 16;
    let mut code_hash = [0u8; 32];
    code_hash.copy_from_slice(&data[header_size..header_size + 32]);

    let hash_type = data[header_size + 32];

    let args_offset = header_size + 33;
    let args_total = u32::from_le_bytes(
        data[args_offset..args_offset + 4]
            .try_into()
            .map_err(|_| ParseError::MissingField("args length"))?,
    ) as usize;

    let args = if args_total > 4 {
        data[args_offset + 4..args_offset + args_total].to_vec()
    } else {
        Vec::new()
    };

    Ok(CkbScript {
        code_hash,
        hash_type,
        args,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_invalid_length() {
        let data = vec![0u8; 10];
        assert!(parse_intent(&data).is_err());
    }
}
