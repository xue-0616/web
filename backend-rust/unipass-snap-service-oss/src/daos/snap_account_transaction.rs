//! `snap_account_transaction` table.

use bigdecimal::BigDecimal;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

use crate::common::TxStatus;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SnapAccountTransaction {
    pub id: u64,
    pub account_address: Vec<u8>,
    pub chain_id: u64,
    pub nonce: u64,
    pub used_free_quota: u32,
    pub effective_time: NaiveDateTime,
    pub relayer_tx_hash: Option<Vec<u8>>,
    pub custom_transactions: serde_json::Value,
    pub fee_transaction: Option<serde_json::Value>,
    pub estimate_fee: BigDecimal,
    pub fee_token: Option<Vec<u8>>,
    pub fee_decimal: Option<u8>,
    pub fee_amount: Option<BigDecimal>,
    pub free_sig: Option<Vec<u8>>,
    pub transaction_hash: Option<Vec<u8>>,
    pub used_gas: Option<u64>,
    pub gas_price: Option<BigDecimal>,
    pub tank_paid_amount: BigDecimal,
    /// Raw column value. Use [`SnapAccountTransaction::tx_status`] for the typed enum.
    pub status: u8,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl SnapAccountTransaction {
    pub fn tx_status(&self) -> Result<TxStatus, u8> {
        TxStatus::try_from(self.status)
    }
}

#[derive(Debug)]
pub struct NewSnapTx<'a> {
    pub account_address: &'a [u8; 20],
    pub chain_id: u64,
    pub nonce: u64,
    pub used_free_quota: u32,
    pub effective_time: NaiveDateTime,
    pub custom_transactions: &'a serde_json::Value,
    pub fee_transaction: Option<&'a serde_json::Value>,
    pub estimate_fee: &'a BigDecimal,
    pub fee_token: Option<&'a [u8; 20]>,
    pub fee_decimal: Option<u8>,
    pub fee_amount: Option<&'a BigDecimal>,
    pub tank_paid_amount: &'a BigDecimal,
}

pub async fn insert(pool: &MySqlPool, row: NewSnapTx<'_>) -> sqlx::Result<u64> {
    let now = chrono::Utc::now().naive_utc();
    let result = sqlx::query(
        r#"INSERT INTO `snap_account_transaction`
           (account_address, chain_id, nonce, used_free_quota, effective_time,
            custom_transactions, fee_transaction, estimate_fee, fee_token,
            fee_decimal, fee_amount, tank_paid_amount, status,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)"#,
    )
    .bind(row.account_address.as_slice())
    .bind(row.chain_id)
    .bind(row.nonce)
    .bind(row.used_free_quota)
    .bind(row.effective_time)
    .bind(row.custom_transactions)
    .bind(row.fee_transaction)
    .bind(row.estimate_fee)
    .bind(row.fee_token.map(|a| a.as_slice()))
    .bind(row.fee_decimal)
    .bind(row.fee_amount)
    .bind(row.tank_paid_amount)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(result.last_insert_id())
}

pub async fn mark_signed_free_sig(
    pool: &MySqlPool,
    id: u64,
    free_sig: &[u8],
) -> sqlx::Result<()> {
    sqlx::query(
        r#"UPDATE `snap_account_transaction`
           SET status = 1, free_sig = ?, updated_at = ?
           WHERE id = ? AND status = 0"#,
    )
    .bind(free_sig)
    .bind(chrono::Utc::now().naive_utc())
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_on_chain(
    pool: &MySqlPool,
    id: u64,
    transaction_hash: &[u8; 32],
    used_gas: u64,
    gas_price: &BigDecimal,
) -> sqlx::Result<()> {
    sqlx::query(
        r#"UPDATE `snap_account_transaction`
           SET status = 2, transaction_hash = ?, used_gas = ?, gas_price = ?, updated_at = ?
           WHERE id = ? AND status IN (1, 2)"#,
    )
    .bind(transaction_hash.as_slice())
    .bind(used_gas)
    .bind(gas_price)
    .bind(chrono::Utc::now().naive_utc())
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_failed(pool: &MySqlPool, id: u64) -> sqlx::Result<()> {
    sqlx::query(
        r#"UPDATE `snap_account_transaction`
           SET status = 3, updated_at = ?
           WHERE id = ?"#,
    )
    .bind(chrono::Utc::now().naive_utc())
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Fetch paginated tx history for a wallet. Cap hard at 200 (matches the
/// closed-source `api_utils::pagination::MAX_PAGE_SIZE`).
pub async fn list_for_wallet(
    pool: &MySqlPool,
    account_address: &[u8; 20],
    limit: i64,
) -> sqlx::Result<Vec<SnapAccountTransaction>> {
    let limit = limit.clamp(1, 200);
    sqlx::query_as::<_, SnapAccountTransaction>(
        r#"SELECT * FROM `snap_account_transaction`
           WHERE account_address = ?
           ORDER BY created_at DESC
           LIMIT ?"#,
    )
    .bind(account_address.as_slice())
    .bind(limit)
    .fetch_all(pool)
    .await
}

#[cfg(test)]
mod tests {
    #[test]
    fn list_limit_clamps_within_bounds() {
        // Pure numeric contract; no DB needed.
        assert_eq!((-5i64).clamp(1, 200), 1);
        assert_eq!(5_000i64.clamp(1, 200), 200);
        assert_eq!(100i64.clamp(1, 200), 100);
    }
}
