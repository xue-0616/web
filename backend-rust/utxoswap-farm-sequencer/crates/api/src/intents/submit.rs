use actix_web::{web, HttpResponse};
use api_common::{context::AppContext, error::{ApiError, ApiSuccess}};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitFarmIntentRequest {
    pub tx_hash: String,
    pub cell_index: u32,
}

/// POST /api/v1/intents/submit
/// Submit a farm intent (deposit/withdraw/harvest)
pub async fn handler(
    ctx: web::Data<AppContext>,
    body: web::Json<SubmitFarmIntentRequest>,
) -> Result<HttpResponse, ApiError> {
    let req = body.into_inner();

    // 1. Decode tx_hash
    let tx_hash = types::utils::hex_to_bytes(&req.tx_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid tx_hash: {}", e)))?;

    // --- BUG-26 FIX: Check for duplicate intent submission ---
    {
        use sea_orm::{EntityTrait, QueryFilter, ColumnTrait};
        let existing = entity_crate::farm_intents::Entity::find()
            .filter(entity_crate::farm_intents::Column::CellTxHash.eq(tx_hash.clone()))
            .filter(entity_crate::farm_intents::Column::CellIndex.eq(req.cell_index))
            .one(ctx.db())
            .await
            .map_err(|e| ApiError::Internal(format!("DB query error: {}", e)))?;
        if existing.is_some() {
            return Err(ApiError::BadRequest(
                "Duplicate intent: this cell has already been submitted".to_string(),
            ));
        }
    }

    // 2. Fetch cell from CKB node
    // Verify transaction exists on chain
    let client = reqwest::Client::new();
    let rpc_body = serde_json::json!({
        "id": 1, "jsonrpc": "2.0",
        "method": "get_transaction",
        "params": [format!("0x{}", hex::encode(&tx_hash))]
    });
    let resp = client.post(&ctx.config.ckb_rpc_url).json(&rpc_body).send().await
        .map_err(|e| ApiError::Internal(format!("CKB RPC error: {}", e)))?;

    let rpc_result: serde_json::Value = resp.json().await
        .map_err(|e| ApiError::Internal(format!("CKB RPC parse error: {}", e)))?;

    // Validate that the transaction exists and extract cell data
    let tx_status = rpc_result
        .get("result")
        .and_then(|r| r.get("tx_status"))
        .and_then(|s| s.get("status"))
        .and_then(|s| s.as_str())
        .unwrap_or("");

    if tx_status != "committed" {
        return Err(ApiError::BadRequest(format!(
            "Transaction not committed on chain (status: {})",
            tx_status
        )));
    }

    // --- BUG-25 FIX: Parse and validate farm intent from cell data ---
    let cell_data_hex = rpc_result
        .get("result")
        .and_then(|r| r.get("transaction"))
        .and_then(|tx| tx.get("outputs_data"))
        .and_then(|od| od.as_array())
        .and_then(|arr| arr.get(req.cell_index as usize))
        .and_then(|d| d.as_str())
        .ok_or_else(|| ApiError::BadRequest("Cell data not found at specified index".to_string()))?;

    let cell_data = types::utils::hex_to_bytes(cell_data_hex)
        .map_err(|e| ApiError::BadRequest(format!("Invalid cell data hex: {}", e)))?;

    // 3. Parse farm intent from cell data
    let parsed = types::parser::parse_farm_intent(&cell_data)
        .map_err(|e| ApiError::BadRequest(format!("Invalid farm intent cell data: {}", e)))?;

    // 4. Validate intent against pool state (fetch pool from DB)
    // Look up pool state by farm_type_hash
    {
        use sea_orm::{EntityTrait, QueryFilter, ColumnTrait};
        let pool = entity_crate::farm_pools::Entity::find()
            .filter(entity_crate::farm_pools::Column::FarmTypeHash.eq(parsed.farm_type_hash.to_vec()))
            .one(ctx.db())
            .await
            .map_err(|e| ApiError::Internal(format!("DB query error: {}", e)))?;

        if pool.is_none() {
            return Err(ApiError::BadRequest("Farm pool not found for this intent".to_string()));
        }
    }

    // 5. Store in DB
    let now = chrono::Utc::now().naive_utc();
    let intent = entity_crate::farm_intents::ActiveModel {
        cell_tx_hash: sea_orm::Set(tx_hash),
        cell_index: sea_orm::Set(req.cell_index),
        farm_type_hash: sea_orm::Set(parsed.farm_type_hash.to_vec()),
        lock_hash: sea_orm::Set(parsed.lock_hash.to_vec()),
        status: sea_orm::Set(entity_crate::farm_intents::FarmIntentStatus::Pending),
        created_at: sea_orm::Set(now),
        updated_at: sea_orm::Set(now),
        ..Default::default()
    };

    use sea_orm::EntityTrait;
    let result = entity_crate::farm_intents::Entity::insert(intent)
        .exec(ctx.db())
        .await?;

    // 6. Notify pools manager via Redis
    // redis.publish("farm:new_intent", result.last_insert_id)

    Ok(ApiSuccess::json(serde_json::json!({
        "intentId": result.last_insert_id,
    })))
}
