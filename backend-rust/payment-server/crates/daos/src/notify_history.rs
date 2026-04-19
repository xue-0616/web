use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "notify_history")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub user_id: u64, pub title: String, pub body: String, pub notify_type: String, pub is_read: bool, pub created_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
