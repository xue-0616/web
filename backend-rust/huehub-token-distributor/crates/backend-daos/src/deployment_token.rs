use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "deployment_token")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub token_id: u64,
    pub type_script_args: String,
    pub total_supply: String,
    pub decimals: u8,
    pub deploy_tx_hash: Option<String>,
    pub status: String,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
