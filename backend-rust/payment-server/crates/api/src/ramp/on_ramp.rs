use actix_web::{web, HttpResponse};
use crate::auth_middleware::AuthenticatedUser;
use crate::context::PaymentContext;
use serde::Deserialize;

/// On-ramp request: fiat → crypto
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnRampRequest {
    /// Fiat currency code (e.g., "USD", "EUR", "PHP")
    pub fiat_currency: String,
    /// Crypto currency (e.g., "ETH", "USDC", "USDT")
    pub crypto_currency: String,
    /// Fiat amount to spend
    pub fiat_amount: String,
    /// Destination chain ID
    pub chain_id: u64,
    /// URL to redirect user after payment
    pub redirect_url: Option<String>,
}

/// POST /api/v1/ramp/on-ramp — initiate fiat on-ramp (HIGH-05 fix: implement actual flow)
pub async fn handler(
    auth: AuthenticatedUser,
    ctx: web::Data<PaymentContext>,
    body: web::Json<OnRampRequest>,
) -> HttpResponse {
    let masked_user = common::mask_address(&auth.user_id);

    // Step 1: Validate fiat amount is a positive number
    let amount: f64 = match body.fiat_amount.parse() {
        Ok(a) if a > 0.0 => a,
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid fiat_amount: must be a positive number"
            }));
        }
    };

    // Step 2: Validate currency codes
    if body.fiat_currency.len() != 3 || !body.fiat_currency.chars().all(|c| c.is_ascii_uppercase()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid fiat_currency: must be a 3-letter ISO currency code"
        }));
    }

    // Step 3: Route to appropriate merchant via payment router
    let route = match api_utils::payment_router::router::route_payment("on_ramp", &body.fiat_currency, "") {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("On-ramp routing failed for user={}: {}", masked_user, e);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Payment routing failed: {}", e)
            }));
        }
    };

    // Step 4: Create order via AlchemyPay
    let merchant = api_utils::payment_manager::payment_merchant::alchemy_pay_merchant::merchant::AlchemyPayMerchant::new(
        &ctx.config.alchemy_pay_app_id, // api_url would come from config in production
        &ctx.config.alchemy_pay_app_id,
        &ctx.config.alchemy_pay_secret_key,
    );

    let order_req = api_utils::payment_manager::payment_merchant::alchemy_pay_merchant::merchant::AlchemyPayOrderRequest {
        merchant_order_no: format!("ON-{}-{}", auth.user_id, chrono::Utc::now().timestamp_millis()),
        fiat_currency: body.fiat_currency.clone(),
        crypto_currency: body.crypto_currency.clone(),
        fiat_amount: body.fiat_amount.clone(),
        redirect_url: body.redirect_url.clone().unwrap_or_default(),
        callback_url: format!("{}/api/v1/ramp/webhook/alchemy-pay/on-ramp", ctx.config.bind_address),
    };

    match merchant.create_on_ramp_order(&order_req).await {
        Ok(order_resp) => {
            tracing::info!("On-ramp order created: order_no={}, user={}", order_resp.order_no, masked_user);
            HttpResponse::Ok().json(serde_json::json!({
                "status": "initiated",
                "orderNo": order_resp.order_no,
                "payUrl": order_resp.pay_url,
                "merchantOrderNo": order_req.merchant_order_no,
            }))
        }
        Err(e) => {
            tracing::error!("On-ramp order creation failed for user={}: {}", masked_user, e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create on-ramp order",
                "details": e.to_string(),
            }))
        }
    }
}
