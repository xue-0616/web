use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "user_device_info")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub user_id: u64, pub device_id: String, pub push_token: Option<String>, pub platform: String, pub created_at: chrono::NaiveDateTime, pub updated_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
