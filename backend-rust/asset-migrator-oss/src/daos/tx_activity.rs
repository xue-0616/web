//! `tx_activity` — one row per *end-to-end* migration (inbound ↔ outbound
//! correlation). The unique key is `(inbound_chain, inbound_tx_hash)` so
//! each inbound tx produces at most one activity row.

use bigdecimal::BigDecimal;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TxActivityStatus {
    /// Inbound confirmed; outbound not yet built.
    PendingOutbound,
    /// Outbound submitted; awaiting confirmation.
    Submitted,
    /// Outbound confirmed — end-to-end success.
    Completed,
    /// Inbound failed or refunded without an outbound.
    InboundFailed,
    /// Outbound failed after inbound was confirmed — manual intervention.
    OutboundFailed,
}

impl std::fmt::Display for TxActivityStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::PendingOutbound => "pending_outbound",
            Self::Submitted => "submitted",
            Self::Completed => "completed",
            Self::InboundFailed => "inbound_failed",
            Self::OutboundFailed => "outbound_failed",
        })
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TxActivity {
    pub id: u64,
    pub wallet_address: Option<Vec<u8>>,
    pub inbound_chain: String,
    pub inbound_tx_hash: Vec<u8>,
    pub inbound_coin: Option<String>,
    pub inbound_from: Option<Vec<u8>>,
    pub inbound_amount: Option<BigDecimal>,
    pub inbound_token_decimal: Option<u16>,
    pub inbound_tx_error_reason: Option<String>,
    pub outbound_from: Option<String>,
    pub outbound_amount: Option<BigDecimal>,
    pub outbound_token_decimal: Option<u16>,
    pub outbound_tx_error_reason: Option<String>,
    pub outbound_tx_hash: Option<Vec<u8>>,
    pub amount: Option<BigDecimal>,
    pub status: TxActivityStatus,
    pub created_time: NaiveDateTime,
    pub updated_time: NaiveDateTime,
}

/// List recent activity for a given wallet — backs the `/activity/{wallet}`
/// endpoint. The closed-source ELF capped results at 200 per page; we
/// mirror that limit.
pub async fn list_for_wallet(
    pool: &MySqlPool,
    wallet_address: &[u8; 20],
    limit: i64,
) -> sqlx::Result<Vec<TxActivity>> {
    let limit = limit.clamp(1, 200);
    sqlx::query_as::<_, TxActivity>(
        r#"SELECT * FROM `tx_activity`
           WHERE wallet_address = ?
           ORDER BY created_time DESC
           LIMIT ?"#,
    )
    .bind(wallet_address.as_slice())
    .bind(limit)
    .fetch_all(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_display() {
        assert_eq!(TxActivityStatus::PendingOutbound.to_string(), "pending_outbound");
        assert_eq!(TxActivityStatus::Completed.to_string(), "completed");
    }

    #[test]
    fn limit_clamp_bounds() {
        // We can test the clamp logic directly without a DB:
        let l = (-5_i64).clamp(1, 200);
        assert_eq!(l, 1);
        let l = 9999_i64.clamp(1, 200);
        assert_eq!(l, 200);
        let l = 50_i64.clamp(1, 200);
        assert_eq!(l, 50);
    }
}
