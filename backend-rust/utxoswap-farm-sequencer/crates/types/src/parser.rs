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

// P1-M1 fix: the previous revision used `try_into().unwrap()` on the
// three u128 fields below. The unwraps were *technically* unreachable
// given the `cell_data.len() < 97` guard (and the `>= 113` branch for
// `user_reward_debt`), but they still left panics on a hot path that
// processes attacker-controlled cell data — any future weakening of
// the length guard would turn them into a crash-oracle.
//
// The helpers below shift the cast into pure `from_slice_at` /
// `u128_le_at` builders that either succeed with an explicit
// `ParseError::InvalidLength` or produce the decoded value without a
// runtime panic path. Behaviour on the current valid inputs is
// byte-identical to the prior implementation.

/// Copy a fixed-size slice out of `buf` starting at `offset`.
/// Returns `InvalidLength` instead of panicking if the window is
/// beyond `buf.len()` — the only failure mode possible for this op.
fn fixed_slice<const N: usize>(buf: &[u8], offset: usize) -> Result<[u8; N], ParseError> {
    buf.get(offset..offset + N)
        .ok_or(ParseError::InvalidLength(buf.len()))
        .map(|s| {
            let mut out = [0u8; N];
            out.copy_from_slice(s);
            out
        })
}

/// Decode a little-endian u128 at `offset`. Same failure mode as
/// `fixed_slice::<16>` — returns `InvalidLength` rather than
/// panicking if the window runs off the end.
fn u128_le_at(buf: &[u8], offset: usize) -> Result<u128, ParseError> {
    fixed_slice::<16>(buf, offset).map(u128::from_le_bytes)
}

/// Parse farm intent from CKB cell data (molecule encoded).
///
/// Layout (tight-packed, little-endian):
/// - byte 0 .. 1   : intent_type (u8, one of 0..=8)
/// - byte 1 .. 33  : farm_type_hash ([u8; 32])
/// - byte 33 .. 49 : amount (u128 LE)
/// - byte 49 .. 81 : lock_hash ([u8; 32])
/// - byte 81 .. 97 : user_staked_amount (u128 LE)
/// - byte 97 .. 113: user_reward_debt (u128 LE, optional — defaults
///   to 0 for legacy cells shorter than 113 bytes)
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

    let farm_type_hash = fixed_slice::<32>(cell_data, 1)?;
    let amount = u128_le_at(cell_data, 33)?;
    let lock_hash = fixed_slice::<32>(cell_data, 49)?;
    let user_staked_amount = u128_le_at(cell_data, 81)?;

    let user_reward_debt = if cell_data.len() >= 113 {
        u128_le_at(cell_data, 97)?
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a valid 113-byte cell payload with controllable fields
    /// so each test can assert on exactly one axis of behaviour.
    fn build_cell(
        intent: u8,
        farm_hash: [u8; 32],
        amount: u128,
        lock_hash: [u8; 32],
        user_staked: u128,
        reward_debt: Option<u128>,
    ) -> Vec<u8> {
        let mut v = Vec::with_capacity(113);
        v.push(intent);
        v.extend_from_slice(&farm_hash);
        v.extend_from_slice(&amount.to_le_bytes());
        v.extend_from_slice(&lock_hash);
        v.extend_from_slice(&user_staked.to_le_bytes());
        if let Some(rd) = reward_debt {
            v.extend_from_slice(&rd.to_le_bytes());
        }
        v
    }

    // --- length guards ----------------------------------------------------

    #[test]
    fn rejects_empty_input() {
        let err = parse_farm_intent(&[]).unwrap_err();
        matches!(err, ParseError::InvalidLength(0));
    }

    #[test]
    fn rejects_exactly_below_minimum_length() {
        // 96 bytes is one short of the 97-byte floor. Must be rejected
        // with the exact observed length so ops can diagnose.
        let err = parse_farm_intent(&[0u8; 96]).unwrap_err();
        match err {
            ParseError::InvalidLength(n) => assert_eq!(n, 96),
            other => panic!("expected InvalidLength(96), got {other:?}"),
        }
    }

    #[test]
    fn accepts_minimum_97_byte_input_without_reward_debt() {
        let cell = build_cell(0, [1u8; 32], 12345, [2u8; 32], 678, None);
        assert_eq!(cell.len(), 97);
        let p = parse_farm_intent(&cell).expect("97-byte cell must parse");
        assert!(matches!(p.intent_type, FarmIntentType::Deposit));
        assert_eq!(p.amount, 12345);
        assert_eq!(p.user_staked_amount, 678);
        // Defaults to 0 when the optional tail is absent.
        assert_eq!(p.user_reward_debt, 0);
    }

    // --- intent_type dispatch --------------------------------------------

    #[test]
    fn dispatches_every_known_intent_type_byte() {
        let cases: [(u8, FarmIntentType); 9] = [
            (0, FarmIntentType::Deposit),
            (1, FarmIntentType::Withdraw),
            (2, FarmIntentType::Harvest),
            (3, FarmIntentType::WithdrawAndHarvest),
            (4, FarmIntentType::CreatePool),
            (5, FarmIntentType::Fund),
            (6, FarmIntentType::AdminSetEndTime),
            (7, FarmIntentType::AdminSetUdtPerSecond),
            (8, FarmIntentType::AdminRefund),
        ];
        for (byte, expected) in cases {
            let cell = build_cell(byte, [0u8; 32], 0, [0u8; 32], 0, None);
            let p = parse_farm_intent(&cell).expect("valid variant");
            assert_eq!(
                std::mem::discriminant(&p.intent_type),
                std::mem::discriminant(&expected),
                "intent_type byte {byte} did not dispatch correctly"
            );
        }
    }

    #[test]
    fn rejects_unknown_intent_type_byte() {
        // Every byte in 9..=255 is unassigned; sample a few to catch
        // off-by-one regressions at the boundary.
        for byte in [9u8, 10, 42, 255] {
            let cell = build_cell(byte, [0u8; 32], 0, [0u8; 32], 0, None);
            match parse_farm_intent(&cell).unwrap_err() {
                ParseError::UnknownType(b) => assert_eq!(b, byte),
                other => panic!("byte {byte}: expected UnknownType, got {other:?}"),
            }
        }
    }

    // --- field decoding round-trip ---------------------------------------

    #[test]
    fn round_trips_all_fields() {
        let farm_hash = [0xAAu8; 32];
        let lock_hash = [0xBBu8; 32];
        let cell = build_cell(
            1, // Withdraw
            farm_hash,
            u128::MAX,
            lock_hash,
            0x1234_5678_9ABC_DEF0u128,
            Some(7777777),
        );
        let p = parse_farm_intent(&cell).unwrap();
        assert!(matches!(p.intent_type, FarmIntentType::Withdraw));
        assert_eq!(p.farm_type_hash, farm_hash);
        assert_eq!(p.lock_hash, lock_hash);
        assert_eq!(p.amount, u128::MAX);
        assert_eq!(p.user_staked_amount, 0x1234_5678_9ABC_DEF0u128);
        assert_eq!(p.user_reward_debt, 7777777);
    }

    #[test]
    fn ignores_trailing_bytes_past_113() {
        // Legacy-format parser tolerance: anything past byte 113 is
        // silently ignored. This pins that behaviour so a future
        // "treat trailing bytes as a new field" refactor has to
        // explicitly break the test.
        let mut cell = build_cell(0, [0u8; 32], 1, [0u8; 32], 2, Some(3));
        cell.extend_from_slice(&[0xFFu8; 50]);
        let p = parse_farm_intent(&cell).unwrap();
        assert_eq!(p.amount, 1);
        assert_eq!(p.user_staked_amount, 2);
        assert_eq!(p.user_reward_debt, 3);
    }

    // --- internal helpers ------------------------------------------------

    #[test]
    fn fixed_slice_errors_instead_of_panicking_when_truncated() {
        let buf = [0u8; 10];
        match fixed_slice::<16>(&buf, 0) {
            Err(ParseError::InvalidLength(n)) => assert_eq!(n, 10),
            other => panic!("expected InvalidLength(10), got {other:?}"),
        }
    }

    #[test]
    fn u128_le_at_decodes_known_constant() {
        // 0x0102030405060708 as u128 little-endian.
        let mut buf = vec![0u8; 32];
        buf[4..20].copy_from_slice(&0x0102_0304_0506_0708u128.to_le_bytes());
        assert_eq!(u128_le_at(&buf, 4).unwrap(), 0x0102_0304_0506_0708u128);
    }
}
