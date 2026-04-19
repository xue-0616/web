use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use api_common::{
    context::{AppContext, SwapJob},
    operator_key::SolanaSwapRequest,
    security::{validate_solana_pubkey, validate_swap_request, AuthenticatedUser},
};

/// POST /api/v1/trading/swap
///
/// Flow:
/// 0. Authenticate + validate input
/// 1. Get Jupiter V2 quote for the swap
/// 2. Build swap transaction with dynamic slippage + priority fee
/// 3. Store trading_transaction record in DB
/// 4. Submit to tx_submitter queue (Jito Bundle primary, RPC fallback)
pub async fn handler(
    req_http: HttpRequest,
    ctx: web::Data<AppContext>,
    body: web::Json<SolanaSwapRequest>,
) -> actix_web::Result<HttpResponse> {
    // --- Auth: extract authenticated user from middleware ---
    let auth_user = req_http
        .extensions()
        .get::<AuthenticatedUser>()
        .cloned()
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Authentication required"))?;

    let req = body.into_inner();

    // --- Input validation (CRIT #2,#3,#4 from audit) ---
    if let Err(msg) = validate_swap_request(
        req.amount_specified,
        req.slippage_bps,
        req.max_priority_fee,
        req.bribery_amount,
    ) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "code": -1,
            "message": msg,
        })));
    }

    // Validate trading_account_pda is a valid Solana pubkey (Audit #19)
    if let Err(msg) = validate_solana_pubkey("trading_account_pda", &req.trading_account_pda) {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "code": -1,
            "message": msg,
        })));
    }

    // Validate other_amount_threshold for i64 overflow
    if req.other_amount_threshold > i64::MAX as u64 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "code": -1,
            "message": "other_amount_threshold exceeds maximum safe value",
        })));
    }

    tracing::info!("Swap request: order_id={}, input={}, output={}, user={}",
        req.order_id, req.input_mint, req.output_mint, auth_user.user_id);

    // 1. Get Jupiter V2 quote
    let api_key = if ctx.jupiter_api_key.is_empty() { None } else { Some(ctx.jupiter_api_key.as_str()) };
    let quote = tx_builder::jupiter::swap::get_quote(api_key, &req)
        .await
        .map_err(|e| {
            tracing::error!("Jupiter quote failed for {}: {}", req.order_id, e);
            actix_web::error::ErrorBadGateway(format!("Jupiter quote failed: {}", e))
        })?;

    // Log price impact warning
    if let Some(ref impact) = quote.price_impact_pct {
        let impact_val: f64 = impact.parse().unwrap_or(0.0);
        if impact_val > 10.0 {
            tracing::warn!("Very high price impact: {}% for order {}", impact, req.order_id);
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "code": 2,
                "message": format!("Price impact too high: {}%", impact),
                "data": { "status": "Failed", "txId": null, "errorReason": "Price impact too high" },
            })));
        }
    }

    // 2. Build swap transaction via Jupiter V2
    let max_priority_fee = req.max_priority_fee.max(100_000); // floor at 100k lamports
    let tx_bytes = tx_builder::jupiter::swap::build_swap_tx(
        api_key,
        &req.trading_account_pda,
        &quote,
        max_priority_fee,
    )
    .await
    .map_err(|e| {
        tracing::error!("Jupiter swap tx build failed for {}: {}", req.order_id, e);
        actix_web::error::ErrorBadGateway(format!("Swap tx build failed: {}", e))
    })?;

    // 3. Store transaction record in DB (safe casts — validated above)
    let now = chrono::Utc::now().naive_utc();
    let tx_model = entity_crate::trading_transactions::ActiveModel {
        order_id: sea_orm::Set(req.order_id.clone()),
        user_id: sea_orm::Set(auth_user.user_id.clone()),
        trading_account_pda: sea_orm::Set(req.trading_account_pda),
        input_mint: sea_orm::Set(req.input_mint),
        output_mint: sea_orm::Set(req.output_mint),
        amount_specified: sea_orm::Set(req.amount_specified as i64),
        other_amount_threshold: sea_orm::Set(req.other_amount_threshold as i64),
        slippage_bps: sea_orm::Set(req.slippage_bps as i16),
        base_in: sea_orm::Set(req.base_in),
        fee_rate_bps: sea_orm::Set(req.fee_rate_bps as i16),
        max_priority_fee: sea_orm::Set(req.max_priority_fee as i64),
        is_anti_mev: sea_orm::Set(req.is_anti_mev),
        bribery_amount: sea_orm::Set(req.bribery_amount as i64),
        swap_type: sea_orm::Set(format!("{:?}", req.swap_type)),
        trigger_price_usd: sea_orm::Set(req.trigger_price_usd),
        status: sea_orm::Set(entity_crate::trading_transactions::TxStatus::Pending),
        created_at: sea_orm::Set(now),
        updated_at: sea_orm::Set(now),
        ..Default::default()
    };

    // --- Duplicate order_id guard (Audit #6/#22) ---
    use sea_orm::{EntityTrait, QueryFilter, ColumnTrait};
    let existing = entity_crate::trading_transactions::Entity::find()
        .filter(entity_crate::trading_transactions::Column::OrderId.eq(&req.order_id))
        .one(ctx.db())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;
    if existing.is_some() {
        return Ok(HttpResponse::Conflict().json(serde_json::json!({
            "code": -1,
            "message": format!("Duplicate order_id: {}", req.order_id),
        })));
    }

    let result = entity_crate::trading_transactions::Entity::insert(tx_model)
        .exec(ctx.db())
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    // 4. Submit to tx_submitter queue (Jito Bundle primary, RPC fallback)
    if let Some(ref sender) = ctx.tx_sender {
        let job = SwapJob {
            order_id: req.order_id.clone(),
            tx_bytes,
            is_anti_mev: req.is_anti_mev,
            bribery_amount: req.bribery_amount,
            consensus_votes: req.consensus_votes,
            is_sell: req.is_sell,
        };
        // Use try_send to avoid blocking the HTTP handler when the channel is full (Audit #7).
        // The channel has 256 capacity; if full, we reject immediately instead of stalling.
        match sender.try_send(job) {
            Ok(()) => {}
            Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => {
                tracing::error!("TX queue full, rejecting swap {}", req.order_id);
                return Ok(HttpResponse::ServiceUnavailable().json(serde_json::json!({
                    "code": -1,
                    "message": "Server busy, transaction queue full. Please retry later.",
                })));
            }
            Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => {
                tracing::error!("TX queue closed, cannot enqueue swap {}", req.order_id);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "code": -1,
                    "message": "Transaction processing unavailable",
                })));
            }
        }
    } else {
        tracing::warn!("No tx_sender configured, swap {} not submitted", req.order_id);
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "code": 0,
        "message": "success",
        "data": {
            "orderId": req.order_id,
            "txId": result.last_insert_id,
            "status": "Created",
        },
    })))
}
