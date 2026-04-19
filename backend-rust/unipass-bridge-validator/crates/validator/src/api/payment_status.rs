use actix_web::{web, HttpResponse};

/// GET /api/v1/payment/status?txHash=0x...
/// Returns the current status of a bridge payment validation.
pub async fn handler(
    ctx: web::Data<api::ValidatorContext>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let tx_hash = match query.get("txHash") {
        Some(h) => h.clone(),
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Missing required parameter: txHash"
            }));
        }
    };

    if !validator_handler::utils::is_valid_tx_hash(&tx_hash) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid txHash format"
        }));
    }

    // Check Redis for processed status first (fast path)
    let _redis_key_pattern = format!("processed:*:{}:*", tx_hash.to_lowercase());
    let mut status = "unknown".to_string();

    // Check DB
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
    let tx_hash_bytes = match hex::decode(tx_hash.trim_start_matches("0x")) {
        Ok(b) => b,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid txHash hex"
            }));
        }
    };

    match validator_daos::payment::Entity::find()
        .filter(validator_daos::payment::Column::TxHash.eq(tx_hash_bytes))
        .one(ctx.db())
        .await
    {
        Ok(Some(payment)) => {
            status = payment.status;
        }
        Ok(None) => {
            // Check bridge_event table for processed events
            let tx_bytes = hex::decode(tx_hash.trim_start_matches("0x")).unwrap_or_default();
            match validator_daos::bridge_event::Entity::find()
                .filter(validator_daos::bridge_event::Column::TxHash.eq(tx_bytes))
                .one(ctx.db())
                .await
            {
                Ok(Some(_)) => {
                    status = "processed".to_string();
                }
                _ => {}
            }
        }
        Err(e) => {
            tracing::error!("DB error checking payment status: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal error"
            }));
        }
    }

    HttpResponse::Ok().json(serde_json::json!({
        "status": status,
        "tx_hash": tx_hash,
    }))
}
