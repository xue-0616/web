use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "payment")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub user_id: u64,
    pub chain_id: u64,
    pub payment_type: i32,    // 0=payment, 100=Bitrefill, 1000=AlchemyPay, 1001=Wind
    pub to_address: Vec<u8>,
    pub token_address: Option<Vec<u8>>,
    pub amount: String,
    pub fee_token: Option<Vec<u8>>,
    pub fee_amount: Option<String>,
    pub tx_hash: Option<Vec<u8>>,
    pub status: String,
    pub error_msg: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
