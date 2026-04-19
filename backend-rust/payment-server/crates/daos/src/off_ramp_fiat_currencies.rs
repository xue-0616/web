use sea_orm::entity::prelude::*; use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "off_ramp_fiat_currencies")]
pub struct Model { #[sea_orm(primary_key)] pub id: u64, pub currency_code: String, pub currency_name: String, pub min_amount: String, pub max_amount: String, pub provider: String, pub is_active: bool, pub created_at: chrono::NaiveDateTime }
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)] pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
