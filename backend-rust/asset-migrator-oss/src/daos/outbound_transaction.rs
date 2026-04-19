//! `outbound_transaction` — one row per outbound tx submitted to a
//! destination chain.

use bigdecimal::BigDecimal;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OutboundTxStatus {
    /// Built but not yet submitted (nonce assigned, signature ready).
    Prepared,
    /// Broadcast to RPC, awaiting first confirmation.
    Submitted,
    /// `n`-block confirmed, success.
    Confirmed,
    /// Mined with a revert or ran out of gas.
    Failed,
    /// Stuck too long; will be replaced with higher gas.
    Stuck,
}

impl std::fmt::Display for OutboundTxStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Prepared => "prepared",
            Self::Submitted => "submitted",
            Self::Confirmed => "confirmed",
            Self::Failed => "failed",
            Self::Stuck => "stuck",
        })
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct OutboundTransaction {
    pub id: u64,
    pub chain_id: i64,
    pub chain_name: String,
    pub token_address: String,
    pub block_number: Option<u64>,
    pub from_address: Option<Vec<u8>>,
    pub to_address: Option<Vec<u8>>,
    pub amount: Option<BigDecimal>,
    pub tx_hash: Option<Vec<u8>>,
    pub status: OutboundTxStatus,
    pub error_reason: Option<String>,
    pub created_time: NaiveDateTime,
    pub updated_time: NaiveDateTime,
}

pub async fn mark_submitted(
    pool: &MySqlPool,
    id: u64,
    tx_hash: &[u8; 32],
) -> sqlx::Result<()> {
    let now = chrono::Utc::now().naive_utc();
    sqlx::query(
        r#"UPDATE `outbound_transaction`
           SET status='submitted', tx_hash=?, updated_time=?
           WHERE id = ?"#,
    )
    .bind(tx_hash.as_slice())
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_confirmed(
    pool: &MySqlPool,
    id: u64,
    block_number: u64,
) -> sqlx::Result<()> {
    let now = chrono::Utc::now().naive_utc();
    sqlx::query(
        r#"UPDATE `outbound_transaction`
           SET status='confirmed', block_number=?, updated_time=?
           WHERE id = ?"#,
    )
    .bind(block_number)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_display() {
        assert_eq!(OutboundTxStatus::Prepared.to_string(), "prepared");
        assert_eq!(OutboundTxStatus::Stuck.to_string(), "stuck");
    }
}
