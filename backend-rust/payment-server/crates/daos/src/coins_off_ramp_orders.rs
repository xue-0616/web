use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "coins_off_ramp_orders")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub user_id: u64, pub order_id: String, pub amount: String, pub fiat_currency: String, pub status: String, pub created_at: chrono::NaiveDateTime, pub updated_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
