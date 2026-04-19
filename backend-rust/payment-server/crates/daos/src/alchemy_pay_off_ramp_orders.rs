use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "alchemy_pay_off_ramp_orders")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub user_id: u64, pub order_no: String, pub crypto_currency: String, pub crypto_amount: String, pub fiat_currency: String, pub fiat_amount: Option<String>, pub status: String, pub created_at: chrono::NaiveDateTime, pub updated_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
