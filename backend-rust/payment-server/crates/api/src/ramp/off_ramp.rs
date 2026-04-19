use actix_web::{web, HttpResponse};
use crate::auth_middleware::AuthenticatedUser;
use crate::context::PaymentContext;
use serde::Deserialize;

/// Off-ramp request: crypto → fiat
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OffRampRequest {
    /// Fiat currency code (e.g., "PHP", "USD")
    pub fiat_currency: String,
    /// Amount in crypto to sell
    pub crypto_amount: String,
    /// Crypto token (e.g., "USDC", "USDT")
    pub crypto_currency: String,
    /// ISO 3166-1 alpha-2 country code (e.g., "PH", "US")
    pub country: String,
    /// Bank code (for bank transfer off-ramp)
    pub bank_code: Option<String>,
    /// Bank account number
    pub account_number: Option<String>,
}

/// POST /api/v1/ramp/off-ramp — initiate fiat off-ramp (HIGH-05 fix: implement actual flow)
pub async fn handler(
    auth: AuthenticatedUser,
    ctx: web::Data<PaymentContext>,
    body: web::Json<OffRampRequest>,
) -> HttpResponse {
    let masked_user = common::mask_address(&auth.user_id);

    // Step 1: Validate crypto_amount is a positive number
    let amount: f64 = match body.crypto_amount.parse() {
        Ok(a) if a > 0.0 => a,
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid crypto_amount: must be a positive number"
            }));
        }
    };

    // Step 2: Validate country code (2-letter ISO 3166-1 alpha-2)
    if body.country.len() != 2 || !body.country.chars().all(|c| c.is_ascii_uppercase()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid country: must be a 2-letter ISO 3166-1 alpha-2 code"
        }));
    }

    // Step 3: Route to appropriate off-ramp merchant
    let route = match api_utils::payment_router::router::route_payment("off_ramp", &body.fiat_currency, &body.country) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Off-ramp routing failed for user={}: {}", masked_user, e);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Payment routing failed: {}", e)
            }));
        }
    };

    // Step 4: Execute off-ramp via appropriate merchant
    let order_id = format!("OFF-{}-{}", auth.user_id, chrono::Utc::now().timestamp_millis());

    match route {
        api_utils::payment_router::router::PaymentRoute::Coins => {
            // Philippines off-ramp via Coins
            let bank_code = match &body.bank_code {
                Some(bc) if !bc.is_empty() => bc.as_str(),
                _ => {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "bank_code is required for Philippines off-ramp"
                    }));
                }
            };
            let account_no = match &body.account_number {
                Some(an) if !an.is_empty() => an.as_str(),
                _ => {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "account_number is required for Philippines off-ramp"
                    }));
                }
            };

            let merchant = api_utils::payment_manager::payment_merchant::coins_merchant::merchant::CoinsMerchant::new(
                "", // api_url from config
                &ctx.config.coins_ph_api_key,
            );
            match merchant.create_payout(&body.crypto_amount, bank_code, account_no).await {
                Ok(resp) => {
                    tracing::info!("Off-ramp order created via Coins: order_id={}, user={}", order_id, masked_user);
                    HttpResponse::Ok().json(serde_json::json!({
                        "status": "initiated",
                        "orderId": order_id,
                        "merchant": "coins",
                        "details": resp,
                    }))
                }
                Err(e) => {
                    tracing::error!("Off-ramp via Coins failed for user={}: {}", masked_user, e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to create off-ramp order",
                        "details": e.to_string(),
                    }))
                }
            }
        }
        api_utils::payment_router::router::PaymentRoute::Wind => {
            let params = serde_json::json!({
                "orderId": order_id,
                "amount": body.crypto_amount,
                "cryptoCurrency": body.crypto_currency,
                "fiatCurrency": body.fiat_currency,
                "country": body.country,
            });

            let wind_client = api_utils::wind_manager::client::WindClient::new(
                "", // api_url from config
                &ctx.config.wind_api_key,
            );
            match wind_client.create_off_ramp_order(&params).await {
                Ok(resp) => {
                    tracing::info!("Off-ramp order created via Wind: order_id={}, user={}", order_id, masked_user);
                    HttpResponse::Ok().json(serde_json::json!({
                        "status": "initiated",
                        "orderId": order_id,
                        "merchant": "wind",
                        "details": resp,
                    }))
                }
                Err(e) => {
                    tracing::error!("Off-ramp via Wind failed for user={}: {}", masked_user, e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to create off-ramp order",
                        "details": e.to_string(),
                    }))
                }
            }
        }
        _ => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "No off-ramp merchant available for this route"
            }))
        }
    }
}
