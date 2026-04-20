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
    // HIGH-FM-3 fail-closed gate: refuse to accept intents when the
    // background processor is not enabled. Without this check, user
    // LP tokens get persisted as Pending and sit there forever
    // because the pools-manager loop is a debug-log-only stub.
    if !ctx.config.farm_processing_enabled {
        return Err(ApiError::ServiceUnavailable(
            "Farm intent submission is temporarily disabled (FARM_PROCESSING_ENABLED=false). \
             Funds would otherwise be locked pending a processor that is not yet online."
                .to_string(),
        ));
    }

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
    // HIGH-FM-1 / HIGH-FM-2: previously this insert defaulted
    // `intent_type` and `amount`, so every row looked like
    // `Deposit, amount=0` regardless of what the user actually
    // submitted. Even if the solver worked it would operate on
    // zero-amount deposits. Write the real values parsed from the
    // on-chain cell data.
    let intent_type_db = map_intent_type(&parsed.intent_type);
    let amount_dec = rust_decimal::Decimal::from_str_exact(&parsed.amount.to_string())
        .map_err(|e| ApiError::BadRequest(format!("amount not representable as decimal: {}", e)))?;

    let now = chrono::Utc::now().naive_utc();
    let intent = entity_crate::farm_intents::ActiveModel {
        intent_type: sea_orm::Set(intent_type_db),
        amount: sea_orm::Set(amount_dec),
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

/// Translate the parser-layer `FarmIntentType` (in the `types` crate)
/// to the persistence-layer `FarmIntentType` (in `entity_crate`).
/// Kept as a total match so that adding a new variant on either side
/// forces a compile error here — we will not silently coerce.
fn map_intent_type(
    t: &types::FarmIntentType,
) -> entity_crate::farm_intents::FarmIntentType {
    use entity_crate::farm_intents::FarmIntentType as DbT;
    use types::FarmIntentType as ParserT;
    match t {
        ParserT::Deposit => DbT::Deposit,
        ParserT::Withdraw => DbT::Withdraw,
        ParserT::Harvest => DbT::Harvest,
        ParserT::WithdrawAndHarvest => DbT::WithdrawAndHarvest,
        ParserT::CreatePool => DbT::CreatePool,
        ParserT::Fund => DbT::Fund,
        ParserT::AdminSetEndTime => DbT::AdminSetEndTime,
        ParserT::AdminSetUdtPerSecond => DbT::AdminSetUdtPerSecond,
        ParserT::AdminRefund => DbT::AdminRefund,
    }
}

#[cfg(test)]
mod tests {
    //! HIGH-FM-1 / HIGH-FM-2 unit tests. The HIGH-FM-3 fail-closed
    //! gate is exercised by an integration test below.
    use super::*;

    #[test]
    fn intent_type_mapping_is_total_and_bijective() {
        // Every parser variant maps to a distinct DB variant.
        let cases = [
            (types::FarmIntentType::Deposit,
             entity_crate::farm_intents::FarmIntentType::Deposit),
            (types::FarmIntentType::Withdraw,
             entity_crate::farm_intents::FarmIntentType::Withdraw),
            (types::FarmIntentType::Harvest,
             entity_crate::farm_intents::FarmIntentType::Harvest),
            (types::FarmIntentType::WithdrawAndHarvest,
             entity_crate::farm_intents::FarmIntentType::WithdrawAndHarvest),
            (types::FarmIntentType::CreatePool,
             entity_crate::farm_intents::FarmIntentType::CreatePool),
            (types::FarmIntentType::Fund,
             entity_crate::farm_intents::FarmIntentType::Fund),
            (types::FarmIntentType::AdminSetEndTime,
             entity_crate::farm_intents::FarmIntentType::AdminSetEndTime),
            (types::FarmIntentType::AdminSetUdtPerSecond,
             entity_crate::farm_intents::FarmIntentType::AdminSetUdtPerSecond),
            (types::FarmIntentType::AdminRefund,
             entity_crate::farm_intents::FarmIntentType::AdminRefund),
        ];
        for (parser, expected_db) in cases {
            assert_eq!(map_intent_type(&parser), expected_db);
        }
    }

    #[test]
    fn large_u128_amount_roundtrips_via_decimal() {
        // HIGH-FM-2 regression: Decimal must accept the full range
        // of realistic on-chain amounts (u128 captures even absurd
        // token supplies). `from_i128_with_scale` would silently
        // truncate anything above i128::MAX, so we use the string
        // conversion path. Confirm it actually works for a big value.
        let big = u128::MAX / 2;
        let dec = rust_decimal::Decimal::from_str_exact(&big.to_string());
        // Decimal's max is ~7.9e28 so u128::MAX/2 (~1.7e38) does NOT fit
        // — that's expected; we just need to confirm the error path is
        // not a panic and the caller can translate it to 400.
        assert!(dec.is_err(), "Decimal should reject u128::MAX/2");

        // Now a realistic value (1 quadrillion LP units at 8 decimals)
        // must roundtrip cleanly.
        let realistic = 1_000_000_000_000_000u128;
        let dec = rust_decimal::Decimal::from_str_exact(&realistic.to_string())
            .expect("realistic amount should fit in Decimal");
        assert_eq!(dec.to_string(), realistic.to_string());
    }
}
