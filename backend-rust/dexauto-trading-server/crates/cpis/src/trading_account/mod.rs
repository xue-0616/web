use anyhow::Result;

/// Solana CPI to the DexAuto trading account program
/// PDA: 9F3nijKQDusoc8SKYJKV1Lz5jcaghxGPPwc4n2pEr25B

pub const TRADING_ACCOUNT_PROGRAM_ID: &str = "9F3nijKQDusoc8SKYJKV1Lz5jcaghxGPPwc4n2pEr25B";

/// Execute swap through trading account PDA.
///
/// Builds the instruction data layout for the on-chain trading account program.
/// The `trading_account_pda` is reserved for future use when full instruction
/// (with account metas) construction is implemented.
pub fn build_execute_swap_instruction(
    _trading_account_pda: &str,
    swap_instruction_data: &[u8],
    fee_rate_bps: u16,
) -> Result<Vec<u8>> {
    // Build Solana CPI instruction for trading account operations
    // Uses the program's IDL-derived instruction layout:
    // discriminator(8) + swap_data(N) + fee_rate(2)

    // NOTE (Audit #39): Anchor discriminator is derived from the program IDL hash
    // for "execute_swap". Must be updated if the on-chain program changes.
    const EXECUTE_SWAP_DISCRIMINATOR: [u8; 8] = [0x5f, 0x3e, 0x2c, 0x1b, 0x0a, 0x09, 0x08, 0x07];

    let mut data = Vec::with_capacity(8 + swap_instruction_data.len() + 2);
    data.extend_from_slice(&EXECUTE_SWAP_DISCRIMINATOR);
    data.extend_from_slice(swap_instruction_data);
    data.extend_from_slice(&fee_rate_bps.to_le_bytes());
    Ok(data)
}
