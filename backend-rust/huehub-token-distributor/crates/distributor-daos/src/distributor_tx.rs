use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "distributor_tx")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub token_id: u64,
    pub recipient_address: String,
    pub amount: String,
    pub tx_hash: Option<String>,
    pub status: String,   // Pending, Submitted, Confirmed, Failed
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
