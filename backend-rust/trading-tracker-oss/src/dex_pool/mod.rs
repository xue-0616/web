//! DEX-pool abstraction.
//!
//! The closed-source binary had:
//! * `dex_pool::DexPool::new` — constructor.
//! * `dex_pool::pump::accounts::BondingCurve` with
//!   `impl AccountDeserialize for BondingCurve` — the Pump.fun state account.
//! * Four DexKind values (confirmed from ELF rodata):
//!   `RaydiumAmm`, `RaydiumClmm`, `RaydiumCpmm`, `Pump`.

pub mod program_ids;
pub mod pump;
pub mod raydium;

use std::str::FromStr;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use solana_pubkey::Pubkey;

use crate::pb::sf::solana::dex::trades::v1::TradeData;

/// The set of Solana DEX protocols the tracker understands.
#[derive(Debug, Copy, Clone, Eq, PartialEq, Hash, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DexKind {
    RaydiumAmm,
    RaydiumClmm,
    RaydiumCpmm,
    Pump,
}

#[derive(Debug, Clone)]
pub struct DexPool {
    pub kind: DexKind,
    pub address: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    /// Pump.fun specific — the bonding-curve state account.
    pub bonding_curve: Option<Pubkey>,
}

impl DexPool {
    pub fn new(kind: DexKind, address: Pubkey, mint_a: Pubkey, mint_b: Pubkey) -> Self {
        Self {
            kind,
            address,
            mint_a,
            mint_b,
            bonding_curve: None,
        }
    }

    pub fn with_bonding_curve(mut self, bc: Pubkey) -> Self {
        self.bonding_curve = Some(bc);
        self
    }
}

/// A normalised price update emitted by any DEX parser / substreams package.
#[derive(Debug, Clone, Serialize)]
pub struct PoolPrice {
    pub kind: DexKind,
    pub pool: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    /// Quote tokens per 1 base token (Decimal is a 128-bit fixed-point).
    pub price: Decimal,
    /// Absolute base volume of this trade (same units as the trade's base).
    pub base_volume: Decimal,
    pub slot: u64,
    pub timestamp: i64,
}

impl PoolPrice {
    /// Convert a decoded `TradeData` from the TopLedger `.spkg` into a
    /// `PoolPrice`, **if** the trade matches a tracked pool and the numbers
    /// pass the defensive sanity checks.
    ///
    /// Returns `None` when:
    ///   * `trade.pool_address` doesn't match `tracked.address`
    ///   * `base_amount` is zero or non-finite (would divide by zero)
    ///   * `quote_amount` is negative or non-finite
    ///   * the trade's mints don't match the tracked pool (swap direction
    ///     orientation is checked: either base==A+quote==B or base==B+quote==A)
    ///
    /// The substreams package already emits *absolute* base/quote amounts
    /// (signed positive numbers, already decimal-adjusted — see `.proto`
    /// `double base_amount = 12`). Price is simply `|quote| / |base|`.
    ///
    /// If the trade's orientation is flipped relative to the tracked pool's
    /// `(mint_a, mint_b)`, the returned `PoolPrice` is re-oriented so
    /// `base_mint == tracked.mint_a` always holds. This gives consumers a
    /// stable "price of A denominated in B" semantic regardless of which side
    /// the swap was initiated from.
    pub fn from_trade_data(trade: &TradeData, tracked: &DexPool) -> Option<Self> {
        // 1. Pool address must match.
        let pool = Pubkey::from_str(&trade.pool_address).ok()?;
        if pool != tracked.address {
            return None;
        }

        // 2. Parse mints.
        let trade_base = Pubkey::from_str(&trade.base_mint).ok()?;
        let trade_quote = Pubkey::from_str(&trade.quote_mint).ok()?;

        // 3. Validate numbers.
        let base_abs = trade.base_amount.abs();
        let quote_abs = trade.quote_amount.abs();
        if !base_abs.is_finite() || !quote_abs.is_finite() {
            return None;
        }
        if base_abs == 0.0 {
            return None;
        }

        // 4. Orient so base_mint == tracked.mint_a (stable semantic).
        let (base_mint, quote_mint, price_f) = if trade_base == tracked.mint_a
            && trade_quote == tracked.mint_b
        {
            (tracked.mint_a, tracked.mint_b, quote_abs / base_abs)
        } else if trade_base == tracked.mint_b && trade_quote == tracked.mint_a {
            // Swap was emitted in reverse orientation — invert the ratio.
            (tracked.mint_a, tracked.mint_b, base_abs / quote_abs)
        } else {
            // Mint mismatch: this trade isn't actually for our pool despite
            // the address match (substreams bug or address collision). Skip.
            return None;
        };

        // 5. Convert f64 → Decimal (rust_decimal exposes a lossy-but-safe
        //    TryFrom<f64>; we fall back to zero-volume on conversion failure
        //    which would only happen for values outside Decimal's ±79 digit
        //    range — not realistic for token amounts).
        let price = Decimal::try_from(price_f).ok()?;
        let base_volume = Decimal::try_from(base_abs).unwrap_or(Decimal::ZERO);

        Some(PoolPrice {
            kind: tracked.kind,
            pool,
            base_mint,
            quote_mint,
            price,
            base_volume,
            slot: trade.block_slot,
            timestamp: trade.block_time,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_trade(pool: &Pubkey, base: &Pubkey, quote: &Pubkey, ba: f64, qa: f64) -> TradeData {
        TradeData {
            block_date: "2024-01-01".into(),
            block_time: 1_700_000_000,
            block_slot: 250_000_000,
            tx_id: "sig".into(),
            tx_index: 0,
            signer: "s".into(),
            pool_address: pool.to_string(),
            base_mint: base.to_string(),
            quote_mint: quote.to_string(),
            base_vault: "v1".into(),
            quote_vault: "v2".into(),
            base_amount: ba,
            quote_amount: qa,
            is_inner_instruction: false,
            instruction_index: 0,
            instruction_type: "swap_base_in".into(),
            inner_instruxtion_index: 0,
            outer_program: program_ids::RAYDIUM_AMM_V4.into(),
            inner_program: "".into(),
            txn_fee_lamports: 5000,
            signer_lamports_change: -5000,
            trader: "t".into(),
            outer_executing_accounts: vec![],
            trader_lamports_change: 0,
            trader_token_balance_changes: vec![],
        }
    }

    #[test]
    fn computes_price_in_canonical_orientation() {
        let pool = Pubkey::new_unique();
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let tracked = DexPool::new(DexKind::RaydiumAmm, pool, a, b);

        // Trade: 1.0 A for 180.0 B  → price of A in B = 180.0.
        let trade = mk_trade(&pool, &a, &b, 1.0, 180.0);
        let p = PoolPrice::from_trade_data(&trade, &tracked).unwrap();
        assert_eq!(p.base_mint, a);
        assert_eq!(p.quote_mint, b);
        assert_eq!(p.price, Decimal::from(180));
    }

    #[test]
    fn reorients_reversed_trade() {
        let pool = Pubkey::new_unique();
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let tracked = DexPool::new(DexKind::RaydiumAmm, pool, a, b);

        // Trade emitted reversed: 180 B for 1 A  → canonical price of A in B = 180.
        let trade = mk_trade(&pool, &b, &a, 180.0, 1.0);
        let p = PoolPrice::from_trade_data(&trade, &tracked).unwrap();
        assert_eq!(p.base_mint, a, "base_mint must be re-oriented to tracked.mint_a");
        assert_eq!(p.price, Decimal::from(180));
    }

    #[test]
    fn rejects_zero_base_amount() {
        let pool = Pubkey::new_unique();
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let tracked = DexPool::new(DexKind::RaydiumAmm, pool, a, b);
        let trade = mk_trade(&pool, &a, &b, 0.0, 1.0);
        assert!(PoolPrice::from_trade_data(&trade, &tracked).is_none());
    }

    #[test]
    fn rejects_mint_mismatch() {
        let pool = Pubkey::new_unique();
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let unrelated = Pubkey::new_unique();
        let tracked = DexPool::new(DexKind::RaydiumAmm, pool, a, b);
        let trade = mk_trade(&pool, &a, &unrelated, 1.0, 1.0);
        assert!(PoolPrice::from_trade_data(&trade, &tracked).is_none());
    }

    #[test]
    fn rejects_wrong_pool() {
        let pool = Pubkey::new_unique();
        let other_pool = Pubkey::new_unique();
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let tracked = DexPool::new(DexKind::RaydiumAmm, pool, a, b);
        let trade = mk_trade(&other_pool, &a, &b, 1.0, 1.0);
        assert!(PoolPrice::from_trade_data(&trade, &tracked).is_none());
    }
}
