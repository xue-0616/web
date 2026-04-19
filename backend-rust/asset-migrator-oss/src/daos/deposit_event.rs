//! `deposit_event` — idempotency log for inbound indexer events.
//!
//! Each event is keyed by `(event_source, event_source_id)`. The indexer
//! consults this table before creating an `inbound_transaction` row to
//! guarantee a single logical event never produces two inbound txs even
//! if the upstream event stream replays.

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DepositEvent {
    pub id: u64,
    pub event_source: String,
    pub event_source_id: String,
    pub payload: serde_json::Value,
    #[sqlx(rename = "processed")]
    pub processed: bool,
    pub created_time: NaiveDateTime,
    pub updated_time: NaiveDateTime,
}

/// Record a new event, returning `true` if it was actually inserted (i.e.
/// a fresh event) or `false` if `(event_source, event_source_id)` already
/// existed. Callers use the boolean to decide whether to proceed with the
/// downstream side-effects.
pub async fn record_if_new(
    pool: &MySqlPool,
    event_source: &str,
    event_source_id: &str,
    payload: &serde_json::Value,
) -> sqlx::Result<bool> {
    let now = chrono::Utc::now().naive_utc();
    let result = sqlx::query(
        r#"INSERT IGNORE INTO `deposit_event`
            (event_source, event_source_id, payload, processed, created_time, updated_time)
           VALUES (?, ?, ?, 0, ?, ?)"#,
    )
    .bind(event_source)
    .bind(event_source_id)
    .bind(payload)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

pub async fn mark_processed(
    pool: &MySqlPool,
    event_source: &str,
    event_source_id: &str,
) -> sqlx::Result<()> {
    let now = chrono::Utc::now().naive_utc();
    sqlx::query(
        r#"UPDATE `deposit_event`
           SET processed = 1, updated_time = ?
           WHERE event_source = ? AND event_source_id = ?"#,
    )
    .bind(now)
    .bind(event_source)
    .bind(event_source_id)
    .execute(pool)
    .await?;
    Ok(())
}
