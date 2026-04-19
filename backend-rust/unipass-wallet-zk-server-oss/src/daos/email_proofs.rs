//! `EmailProofs` DAO.
//!
//! Schema (11 columns) recovered verbatim from the ELF's rodata — see
//! `migrations/20240101000001_initial.sql`.

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

use crate::types::EmailType;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct EmailProof {
    /// `char(66)` — `0x`-prefixed keccak256 of the email header, 64 hex chars + `0x`.
    pub header_hash: String,
    /// Raw column value. Use [`EmailProof::typ`] for the typed enum.
    pub email_type: i32,
    pub from_left_index: i32,
    pub from_len: i32,
    pub success: bool,
    /// `char(34)` — small-number encoded as `0x`-prefixed 32-hex string
    /// (matches the ELF's `BigUint::to_str_radix(16)` + pad convention).
    pub public_inputs_num: String,
    pub domain_size: String,
    pub header_pub_match: String,
    pub public_inputs: String,
    pub proof: String,
    pub failed_reason: String,
}

impl EmailProof {
    pub fn typ(&self) -> Result<EmailType, i32> {
        EmailType::try_from(self.email_type)
    }
}

/// Upsert — `INSERT ... ON DUPLICATE KEY UPDATE` so a retry of the same
/// header_hash overwrites the prior attempt (the ELF does this too,
/// which is why its rodata contains "already existed" without a fatal
/// path around it).
pub async fn upsert(pool: &MySqlPool, row: &EmailProof) -> sqlx::Result<()> {
    sqlx::query(
        r#"INSERT INTO EmailProofs
           (header_hash, email_type, from_left_index, from_len, success,
            public_inputs_num, domain_size, header_pub_match,
            public_inputs, proof, failed_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             email_type = VALUES(email_type),
             from_left_index = VALUES(from_left_index),
             from_len = VALUES(from_len),
             success = VALUES(success),
             public_inputs_num = VALUES(public_inputs_num),
             domain_size = VALUES(domain_size),
             header_pub_match = VALUES(header_pub_match),
             public_inputs = VALUES(public_inputs),
             proof = VALUES(proof),
             failed_reason = VALUES(failed_reason)"#,
    )
    .bind(&row.header_hash)
    .bind(row.email_type)
    .bind(row.from_left_index)
    .bind(row.from_len)
    .bind(row.success)
    .bind(&row.public_inputs_num)
    .bind(&row.domain_size)
    .bind(&row.header_pub_match)
    .bind(&row.public_inputs)
    .bind(&row.proof)
    .bind(&row.failed_reason)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn find_by_hash(pool: &MySqlPool, header_hash: &str) -> sqlx::Result<Option<EmailProof>> {
    sqlx::query_as::<_, EmailProof>(
        r#"SELECT * FROM EmailProofs WHERE header_hash = ? LIMIT 1"#,
    )
    .bind(header_hash)
    .fetch_optional(pool)
    .await
}

pub async fn exists(pool: &MySqlPool, header_hash: &str) -> sqlx::Result<bool> {
    let row: Option<(i64,)> = sqlx::query_as(
        r#"SELECT 1 FROM EmailProofs WHERE header_hash = ? LIMIT 1"#,
    )
    .bind(header_hash)
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}
