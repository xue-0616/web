//! `deposit_address` — pool of per-chain addresses allocated to wallets
//! for the inbound-side custody flow.
//!
//! Lifecycle (enum values recovered from `invalid value for enum
//! DepositAddressStatus` in the ELF):
//!
//! ```text
//!   Unbound ──allocate_for_wallet──▶ Bound ──sweep──▶ Retired
//! ```

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DepositAddressStatus {
    Unbound,
    Bound,
    Retired,
}

impl std::fmt::Display for DepositAddressStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Unbound => "unbound",
            Self::Bound => "bound",
            Self::Retired => "retired",
        })
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DepositAddress {
    pub id: u64,
    pub chain_name: String,
    pub address: String,
    /// 20-byte EVM wallet address this deposit address is bound to (none = unbound).
    #[serde(with = "hex_opt")]
    pub wallet_address: Option<Vec<u8>>,
    pub status: DepositAddressStatus,
    pub created_time: NaiveDateTime,
    pub updated_time: NaiveDateTime,
}

/// Count unbound addresses per chain — used by the worker to decide whether
/// to batch-request more from the custody wallet API.
pub async fn count_unbound(pool: &MySqlPool, chain_name: &str) -> sqlx::Result<i64> {
    let (n,): (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM `deposit_address` WHERE chain_name = ? AND status = 'unbound'"#,
    )
    .bind(chain_name)
    .fetch_one(pool)
    .await?;
    Ok(n)
}

/// Atomically bind one currently-unbound address to `wallet_address`.
/// Returns `None` if no unbound address is available on the chain.
pub async fn bind_one(
    pool: &MySqlPool,
    chain_name: &str,
    wallet_address: &[u8; 20],
) -> sqlx::Result<Option<DepositAddress>> {
    let mut tx = pool.begin().await?;
    let candidate = sqlx::query_as::<_, DepositAddress>(
        r#"SELECT * FROM `deposit_address`
           WHERE chain_name = ? AND status = 'unbound'
           ORDER BY id ASC LIMIT 1 FOR UPDATE"#,
    )
    .bind(chain_name)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(row) = candidate else {
        tx.rollback().await?;
        return Ok(None);
    };

    let now = chrono::Utc::now().naive_utc();
    sqlx::query(
        r#"UPDATE `deposit_address`
           SET wallet_address = ?, status = 'bound', updated_time = ?
           WHERE id = ?"#,
    )
    .bind(wallet_address.as_slice())
    .bind(now)
    .bind(row.id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Some(DepositAddress {
        wallet_address: Some(wallet_address.to_vec()),
        status: DepositAddressStatus::Bound,
        updated_time: now,
        ..row
    }))
}

mod hex_opt {
    //! Serialise `Option<Vec<u8>>` as `Option<String>` in 0x-prefixed hex.
    use serde::{Deserializer, Serializer, de::Error as _};

    pub fn serialize<S: Serializer>(v: &Option<Vec<u8>>, s: S) -> Result<S::Ok, S::Error> {
        match v {
            None => s.serialize_none(),
            Some(bytes) => s.serialize_str(&format!("0x{}", hex::encode(bytes))),
        }
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Option<Vec<u8>>, D::Error> {
        let opt = <Option<String> as serde::Deserialize>::deserialize(d)?;
        match opt {
            None => Ok(None),
            Some(s) => {
                let s = s.strip_prefix("0x").unwrap_or(&s);
                hex::decode(s).map(Some).map_err(D::Error::custom)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_display() {
        assert_eq!(DepositAddressStatus::Unbound.to_string(), "unbound");
        assert_eq!(DepositAddressStatus::Bound.to_string(), "bound");
        assert_eq!(DepositAddressStatus::Retired.to_string(), "retired");
    }

    #[test]
    fn wallet_address_hex_roundtrip() {
        let row_json = r#"{
            "id": 1, "chain_name": "eth", "address": "0xabc",
            "wallet_address": "0x0102030405060708090a0b0c0d0e0f1011121314",
            "status": "bound",
            "created_time": "2024-01-01T00:00:00",
            "updated_time": "2024-01-01T00:00:00"
        }"#;
        let row: DepositAddress = serde_json::from_str(row_json).unwrap();
        assert_eq!(row.wallet_address.as_ref().unwrap().len(), 20);
        let back = serde_json::to_string(&row).unwrap();
        assert!(back.contains("\"0x0102030405060708090a0b0c0d0e0f1011121314\""));
    }

    #[test]
    fn null_wallet_address_serialises_as_null() {
        let row = DepositAddress {
            id: 1,
            chain_name: "eth".into(),
            address: "0xabc".into(),
            wallet_address: None,
            status: DepositAddressStatus::Unbound,
            created_time: NaiveDateTime::default(),
            updated_time: NaiveDateTime::default(),
        };
        let json = serde_json::to_string(&row).unwrap();
        assert!(json.contains("\"wallet_address\":null"));
    }
}
