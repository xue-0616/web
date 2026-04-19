//! `coin_info` — catalogue of every coin the service knows about.

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

/// Column `coin_purpose` in the `coin_info` table. Value names recovered
/// from `invalid value for enum CoinPurpose` in the ELF's panic strings.
///
/// Note the symbol table also carries `daos::coin_info::CoinPurpose` which
/// pins this type as living in the `daos::coin_info` module.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CoinPurpose {
    Inbound,
    Outbound,
    Both,
}

impl std::fmt::Display for CoinPurpose {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::Inbound => "inbound",
            Self::Outbound => "outbound",
            Self::Both => "both",
        };
        f.write_str(s)
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct CoinInfo {
    pub id: u64,
    pub chain_id: i64,
    pub chain_name: String,
    pub coin_name: String,
    pub token_address: String,
    pub token_decimal: u16,
    pub coin_purpose: CoinPurpose,
    pub created_time: NaiveDateTime,
    pub updated_time: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct NewCoinInfo<'a> {
    pub chain_id: i64,
    pub chain_name: &'a str,
    pub coin_name: &'a str,
    pub token_address: &'a str,
    pub token_decimal: u16,
    pub coin_purpose: CoinPurpose,
}

pub async fn insert(pool: &MySqlPool, row: NewCoinInfo<'_>) -> sqlx::Result<u64> {
    let now = chrono::Utc::now().naive_utc();
    let result = sqlx::query(
        r#"INSERT INTO `coin_info`
            (chain_id, chain_name, coin_name, token_address, token_decimal,
             coin_purpose, created_time, updated_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(row.chain_id)
    .bind(row.chain_name)
    .bind(row.coin_name)
    .bind(row.token_address)
    .bind(row.token_decimal)
    .bind(row.coin_purpose.to_string())
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(result.last_insert_id())
}

pub async fn find_by_chain_and_token(
    pool: &MySqlPool,
    chain_id: i64,
    token_address: &str,
) -> sqlx::Result<Option<CoinInfo>> {
    sqlx::query_as::<_, CoinInfo>(
        r#"SELECT * FROM `coin_info` WHERE chain_id = ? AND token_address = ? LIMIT 1"#,
    )
    .bind(chain_id)
    .bind(token_address)
    .fetch_optional(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coin_purpose_display_is_snake_case() {
        assert_eq!(CoinPurpose::Inbound.to_string(), "inbound");
        assert_eq!(CoinPurpose::Outbound.to_string(), "outbound");
        assert_eq!(CoinPurpose::Both.to_string(), "both");
    }

    #[test]
    fn coin_purpose_serde_roundtrip() {
        let original = CoinPurpose::Outbound;
        let json = serde_json::to_string(&original).unwrap();
        assert_eq!(json, "\"outbound\"");
        let back: CoinPurpose = serde_json::from_str(&json).unwrap();
        assert_eq!(back, original);
    }
}
