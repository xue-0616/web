use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "user_asset_migrator_account")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub user_id: u64, pub old_address: Vec<u8>, pub new_address: Vec<u8>, pub chain_id: u64, pub created_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
