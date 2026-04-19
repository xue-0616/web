use crate::{FarmIntentType, ParsedFarmIntent};

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("Invalid cell data length: {0}")]
    InvalidLength(usize),
    #[error("Unknown intent type: {0}")]
    UnknownType(u8),
    #[error("Invalid farm type hash")]
    InvalidFarmHash,
}

/// Parse farm intent from CKB cell data (molecule encoded)
pub fn parse_farm_intent(cell_data: &[u8]) -> Result<ParsedFarmIntent, ParseError> {
    if cell_data.len() < 97 {
        return Err(ParseError::InvalidLength(cell_data.len()));
    }

    let intent_type_byte = cell_data[0];
    let intent_type = match intent_type_byte {
        0 => FarmIntentType::Deposit,
        1 => FarmIntentType::Withdraw,
        2 => FarmIntentType::Harvest,
        3 => FarmIntentType::WithdrawAndHarvest,
        4 => FarmIntentType::CreatePool,
        5 => FarmIntentType::Fund,
        6 => FarmIntentType::AdminSetEndTime,
        7 => FarmIntentType::AdminSetUdtPerSecond,
        8 => FarmIntentType::AdminRefund,
        _ => return Err(ParseError::UnknownType(intent_type_byte)),
    };

    let mut farm_type_hash = [0u8; 32];
    farm_type_hash.copy_from_slice(&cell_data[1..33]);

    let amount = u128::from_le_bytes(cell_data[33..49].try_into().unwrap());

    let mut lock_hash = [0u8; 32];
    lock_hash.copy_from_slice(&cell_data[49..81]);

    let user_staked_amount = u128::from_le_bytes(cell_data[81..97].try_into().unwrap());

    let user_reward_debt = if cell_data.len() >= 113 {
        u128::from_le_bytes(cell_data[97..113].try_into().unwrap())
    } else {
        0
    };

    Ok(ParsedFarmIntent {
        intent_type,
        farm_type_hash,
        amount,
        lock_hash,
        user_staked_amount,
        user_reward_debt,
    })
}
