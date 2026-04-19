use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "accounts")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u64,
    pub address: Vec<u8>,         // binary(20)
    pub account_status: String,   // InUse, Deleted
    pub sub: Option<String>,
    pub email: Option<String>,
    pub invitation_code: Option<String>,
    pub inviter_user_id: Option<u64>,
    pub invited_time: Option<chrono::NaiveDateTime>,
    pub ip: Option<String>,
    pub country_code: Option<String>,
    pub guide_status: String,     // NotStart, Finished
    pub keyset_hash: Option<Vec<u8>>,
    pub auth_validate_from: Option<String>,
    pub last_login: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}

/// Account info returned for login verification
pub struct AccountInfo {
    pub address: String,
}

/// Look up an account by keyset_hash. Returns the Ethereum address (0x-prefixed hex) if found.
pub async fn find_by_keyset_hash(
    db: &DatabaseConnection,
    keyset_hash: &str,
) -> Result<Option<AccountInfo>, DbErr> {
    let clean = keyset_hash.strip_prefix("0x").unwrap_or(keyset_hash);
    let hash_bytes = hex::decode(clean).map_err(|e| DbErr::Custom(format!("Invalid keyset_hash hex: {}", e)))?;

    let result = Entity::find()
        .filter(Column::KeysetHash.eq(hash_bytes))
        .one(db)
        .await?;

    Ok(result.map(|m| AccountInfo {
        address: format!("0x{}", hex::encode(&m.address)),
    }))
}
