use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "distributor_token")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub token_id: u64,
    pub type_script_args: String,
    pub distributor_address: String,
    pub remaining_amount: String,
    pub status: String,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
