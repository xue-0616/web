//! `snap_account` table.

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

use crate::common::{GuideStatus, ProviderType};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SnapAccount {
    pub id: u64,
    pub account_address: Vec<u8>,
    /// Raw column value. Use [`SnapAccount::provider`] for the typed enum.
    pub provider_type: u8,
    pub provider_identifier: String,
    /// Raw column value. Use [`SnapAccount::guide`] for the typed enum.
    pub guide_status: u8,
    pub register_time: NaiveDateTime,
    pub last_login: NaiveDateTime,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl SnapAccount {
    pub fn provider(&self) -> Result<ProviderType, u8> {
        ProviderType::try_from(self.provider_type)
    }
    pub fn guide(&self) -> Result<GuideStatus, u8> {
        GuideStatus::try_from(self.guide_status)
    }
}

/// Insert-or-fetch: if `(provider_type, provider_identifier)` already
/// exists, return the existing row (and bump `last_login`). Otherwise
/// create a new row. Idempotency is enforced at the DB level by the
/// `account_provider_uk` unique key — we rely on it.
pub async fn ensure(
    pool: &MySqlPool,
    account_address: &[u8; 20],
    provider: ProviderType,
    provider_identifier: &str,
) -> sqlx::Result<SnapAccount> {
    let now = chrono::Utc::now().naive_utc();

    // Try insert — `INSERT IGNORE` silently succeeds on unique-key conflict.
    sqlx::query(
        r#"INSERT IGNORE INTO `snap_account`
           (account_address, provider_type, provider_identifier,
            guide_status, register_time, last_login, created_at, updated_at)
           VALUES (?, ?, ?, 0, ?, ?, ?, ?)"#,
    )
    .bind(account_address.as_slice())
    .bind(provider as u8)
    .bind(provider_identifier)
    .bind(now)
    .bind(now)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;

    // Fetch the (now-guaranteed-present) row and bump last_login.
    sqlx::query(
        r#"UPDATE `snap_account`
           SET last_login = ?, updated_at = ?
           WHERE provider_type = ? AND provider_identifier = ?"#,
    )
    .bind(now)
    .bind(now)
    .bind(provider as u8)
    .bind(provider_identifier)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, SnapAccount>(
        r#"SELECT * FROM `snap_account`
           WHERE provider_type = ? AND provider_identifier = ? LIMIT 1"#,
    )
    .bind(provider as u8)
    .bind(provider_identifier)
    .fetch_one(pool)
    .await
}

pub async fn find_by_wallet(
    pool: &MySqlPool,
    account_address: &[u8; 20],
) -> sqlx::Result<Option<SnapAccount>> {
    sqlx::query_as::<_, SnapAccount>(
        r#"SELECT * FROM `snap_account` WHERE account_address = ? LIMIT 1"#,
    )
    .bind(account_address.as_slice())
    .fetch_optional(pool)
    .await
}

pub async fn set_guide_status(
    pool: &MySqlPool,
    id: u64,
    status: GuideStatus,
) -> sqlx::Result<()> {
    sqlx::query(
        r#"UPDATE `snap_account`
           SET guide_status = ?, updated_at = ?
           WHERE id = ?"#,
    )
    .bind(status as u8)
    .bind(chrono::Utc::now().naive_utc())
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}
