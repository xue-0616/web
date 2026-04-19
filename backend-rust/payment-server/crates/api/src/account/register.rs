use actix_web::{web, HttpResponse};
use crate::context::PaymentContext;
use serde::Deserialize;
use sea_orm::{EntityTrait, ColumnTrait, QueryFilter, ActiveModelTrait, Set};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub keyset_hash: String,
    pub email: Option<String>,
}

/// POST /api/v1/account/register (CRIT-05 fix: implement full registration with DB storage)
pub async fn handler(ctx: web::Data<PaymentContext>, body: web::Json<RegisterRequest>) -> actix_web::Result<HttpResponse> {
    let masked_hash = common::mask_address(&body.keyset_hash);

    // Step 1: Validate keyset_hash format (64-char hex, with optional 0x prefix)
    let clean_hash = body.keyset_hash.strip_prefix("0x").unwrap_or(&body.keyset_hash);
    if clean_hash.len() != 64 {
        tracing::warn!("Registration rejected: invalid keyset_hash length for {}", masked_hash);
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid keyset_hash format: must be 64 hex characters (32 bytes)"
        })));
    }
    let keyset_hash_bytes = hex::decode(clean_hash).map_err(|_| {
        tracing::warn!("Registration rejected: invalid hex in keyset_hash for {}", masked_hash);
        actix_web::error::ErrorBadRequest("Invalid keyset_hash format: must contain only valid hex characters")
    })?;

    // Step 2: Validate optional email format (basic check)
    if let Some(ref email) = body.email {
        if !email.is_empty() && (!email.contains('@') || !email.contains('.')) {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid email format"
            })));
        }
    }

    // Step 3: Check DB for existing registration — reject duplicates (CRIT-05 fix)
    let existing = daos::accounts::Entity::find()
        .filter(daos::accounts::Column::KeysetHash.eq(keyset_hash_bytes.clone()))
        .one(ctx.db())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    if existing.is_some() {
        tracing::warn!("Registration rejected: duplicate keyset_hash={}", masked_hash);
        return Ok(HttpResponse::Conflict().json(serde_json::json!({
            "error": "Account with this keyset_hash already exists"
        })));
    }

    // Step 4: Derive CREATE2 wallet address (CRIT-05 fix)
    let mut keyset_hash_array = [0u8; 32];
    keyset_hash_array.copy_from_slice(&keyset_hash_bytes);

    let wallet_address = api_utils::account_utils::compute_wallet_address(
        ctx.config.factory_address(),
        ctx.config.main_module_address(),
        keyset_hash_array,
    );
    let wallet_addr_hex = format!("0x{}", hex::encode(wallet_address.as_bytes()));
    tracing::info!("Derived wallet address {} for keyset_hash={}", common::mask_address(&wallet_addr_hex), masked_hash);

    // Step 5: Store account in DB (CRIT-05 fix)
    let now = chrono::Utc::now().naive_utc();
    let new_account = daos::accounts::ActiveModel {
        address: Set(wallet_address.as_bytes().to_vec()),
        account_status: Set("InUse".to_string()),
        email: Set(body.email.clone()),
        keyset_hash: Set(Some(keyset_hash_bytes)),
        guide_status: Set("NotStart".to_string()),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };

    let inserted = new_account.insert(ctx.db())
        .await
        .map_err(|e| {
            tracing::error!("Failed to insert account for keyset_hash={}: {}", masked_hash, e);
            actix_web::error::ErrorInternalServerError("Failed to create account")
        })?;

    tracing::info!("Account registered: id={}, keyset_hash={}, address={}",
        inserted.id, masked_hash, common::mask_address(&wallet_addr_hex));

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "registered",
        "keyset_hash": body.keyset_hash,
        "address": wallet_addr_hex,
    })))
}
