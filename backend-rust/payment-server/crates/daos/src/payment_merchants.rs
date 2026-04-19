use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "payment_merchants")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub name: String, pub merchant_type: String, pub api_key: Option<String>, pub is_active: bool, pub created_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
