use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "operator_keys")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub user_id: String,                    // external user id
    pub trading_account_pda: String,        // Solana PDA (base58)
    #[serde(skip_serializing)]
    pub encrypted_private_key: Vec<u8>,     // AWS KMS encrypted
    pub max_priority_fee: i64,
    pub is_active: bool,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
