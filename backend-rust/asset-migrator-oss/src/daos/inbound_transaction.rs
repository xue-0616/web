//! `inbound_transaction` — one row per observed deposit tx on a source chain.
//!
//! `status` values recovered from ELF panic strings
//! (`invalid value for enum InboundTx…`): Pending, Confirmed, Failed,
//! Orphaned.

use bigdecimal::BigDecimal;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum InboundTxStatus {
    Pending,
    Confirmed,
    Failed,
    Orphaned,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct InboundTransaction {
    pub id: u64,
    pub chain_name: String,
    pub coin_name: String,
    pub block_number: Option<u64>,
    pub tx_hash: Vec<u8>,
    pub from_address: Option<Vec<u8>>,
    pub to_address: Option<Vec<u8>>,
    pub amount: Option<BigDecimal>,
    pub status: InboundTxStatus,
    pub error_reason: Option<String>,
    pub event_source_id: Option<String>,
    pub event_source: Option<String>,
    pub created_time: NaiveDateTime,
    pub updated_time: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct NewInboundTransaction<'a> {
    pub chain_name: &'a str,
    pub coin_name: &'a str,
    pub tx_hash: &'a [u8; 32],
    pub block_number: Option<u64>,
    pub from_address: Option<&'a [u8; 20]>,
    pub to_address: Option<&'a [u8; 20]>,
    pub amount: Option<&'a BigDecimal>,
    pub status: InboundTxStatus,
    pub event_source: Option<&'a str>,
    pub event_source_id: Option<&'a str>,
}

/// Insert-if-not-exists using the `(coin_name, tx_hash)` unique key.
/// Returns the id of the row whether it was newly inserted or already existed.
pub async fn upsert(pool: &MySqlPool, row: NewInboundTransaction<'_>) -> sqlx::Result<u64> {
    let now = chrono::Utc::now().naive_utc();
    sqlx::query(
        r#"INSERT INTO `inbound_transaction`
            (chain_name, coin_name, block_number, tx_hash, from_address, to_address,
             amount, status, event_source, event_source_id, created_time, updated_time)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             block_number = VALUES(block_number),
             status = VALUES(status),
             updated_time = VALUES(updated_time)"#,
    )
    .bind(row.chain_name)
    .bind(row.coin_name)
    .bind(row.block_number)
    .bind(row.tx_hash.as_slice())
    .bind(row.from_address.map(|a| a.as_slice()))
    .bind(row.to_address.map(|a| a.as_slice()))
    .bind(row.amount)
    .bind(row.status.to_string())
    .bind(row.event_source)
    .bind(row.event_source_id)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;
    let (id,): (u64,) = sqlx::query_as(
        r#"SELECT id FROM `inbound_transaction` WHERE coin_name = ? AND tx_hash = ?"#,
    )
    .bind(row.coin_name)
    .bind(row.tx_hash.as_slice())
    .fetch_one(pool)
    .await?;
    Ok(id)
}

impl std::fmt::Display for InboundTxStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Pending => "pending",
            Self::Confirmed => "confirmed",
            Self::Failed => "failed",
            Self::Orphaned => "orphaned",
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_serde_roundtrip() {
        for s in [
            InboundTxStatus::Pending,
            InboundTxStatus::Confirmed,
            InboundTxStatus::Failed,
            InboundTxStatus::Orphaned,
        ] {
            let json = serde_json::to_string(&s).unwrap();
            let back: InboundTxStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(back, s);
        }
    }
}
