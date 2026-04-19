use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "i8", db_type = "TinyInteger")]
pub enum RelayerTxStatus {
    #[sea_orm(num_value = 0)] Queued,
    #[sea_orm(num_value = 1)] Pending,
    #[sea_orm(num_value = 2)] Submitted,
    #[sea_orm(num_value = 3)] Confirmed,
    #[sea_orm(num_value = 4)] Failed,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "relayer_transactions")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub chain_id: u64,
    pub from_address: Vec<u8>,
    pub to_address: Vec<u8>,
    pub tx_hash: Option<Vec<u8>>,
    pub calldata: Vec<u8>,
    pub gas_limit: i64,
    pub gas_price: Option<i64>,
    pub nonce: Option<i64>,
    pub value: String,
    pub error_msg: Option<String>,
    pub status: RelayerTxStatus,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
