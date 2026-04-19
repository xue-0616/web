use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Points source type
/// @values 0=Swap, 1=AddLiquidity, 2=RemoveLiquidity, 3=TaskClaim, 4=Referral
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum SourceType {
    #[sea_orm(num_value = 0)]
    Swap,
    #[sea_orm(num_value = 1)]
    AddLiquidity,
    #[sea_orm(num_value = 2)]
    RemoveLiquidity,
    #[sea_orm(num_value = 3)]
    TaskClaim,
    #[sea_orm(num_value = 4)]
    Referral,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "points_history")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    /// Account ID (FK to accounts.id)
    pub account_id: u64,
    /// Points earned
    pub points: u64,
    /// Source type
    pub source_type: SourceType,
    /// Source ID (e.g. intent_id, task_id)
    pub source_id: u64,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
