use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Default invoice expiry duration in hours
pub const DEFAULT_INVOICE_EXPIRY_HOURS: i64 = 24;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "invoices")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub user_id: u64,
    pub invoice_number: String,
    pub recipient_email: String,
    pub amount: String,
    pub currency: String,
    pub status: String,
    pub paypal_invoice_id: Option<String>,
    /// BUG-14 fix: Invoice expiration timestamp.
    /// Payments should be rejected after this time.
    /// Defaults to created_at + DEFAULT_INVOICE_EXPIRY_HOURS when created.
    pub expires_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

impl Model {
    /// Check if this invoice has expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            chrono::Utc::now().naive_utc() > expires_at
        } else {
            false
        }
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
