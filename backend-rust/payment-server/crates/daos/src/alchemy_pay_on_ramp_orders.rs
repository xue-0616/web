use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "alchemy_pay_on_ramp_orders")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub user_id: u64, pub order_no: String, pub fiat_currency: String, pub fiat_amount: String, pub crypto_currency: String, pub crypto_amount: Option<String>, pub network: String, pub address: String, pub status: String, pub created_at: chrono::NaiveDateTime, pub updated_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
