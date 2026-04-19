use actix_web::{web, HttpResponse};

/// GET /api/v1/payment/details?txHash=0x...&sourceChainId=1
/// Returns detailed information about a bridge payment including validation status.
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

    let source_chain_id: Option<u64> = query
        .get("sourceChainId")
        .and_then(|s| s.parse().ok());

    // Look up in DB
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
    let tx_hash_bytes = match hex::decode(tx_hash.trim_start_matches("0x")) {
        Ok(b) => b,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid txHash hex"
            }));
        }
    };

    let mut query_builder = validator_daos::payment::Entity::find()
        .filter(validator_daos::payment::Column::TxHash.eq(tx_hash_bytes));

    if let Some(chain_id) = source_chain_id {
        query_builder = query_builder
            .filter(validator_daos::payment::Column::SourceChainId.eq(chain_id));
    }

    match query_builder.one(ctx.db()).await {
        Ok(Some(payment)) => {
            HttpResponse::Ok().json(serde_json::json!({
                "details": {
                    "source_chain_id": payment.source_chain_id,
                    "dest_chain_id": payment.dest_chain_id,
                    "tx_hash": format!("0x{}", hex::encode(&payment.tx_hash)),
                    "token_address": format!("0x{}", hex::encode(&payment.token_address)),
                    "recipient": format!("0x{}", hex::encode(&payment.recipient)),
                    "amount": payment.amount,
                    "status": payment.status,
                    "created_at": payment.created_at.to_string(),
                }
            }))
        }
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({
                "details": null,
                "error": "Payment not found"
            }))
        }
        Err(e) => {
            tracing::error!("DB error looking up payment details: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal error"
            }))
        }
    }
}
