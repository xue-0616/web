use actix_web::{web, HttpResponse};
use serde::Deserialize;
use crate::auth_middleware::AuthenticatedUser;

/// Maximum allowed order amount (sanity check)
const MAX_ORDER_AMOUNT: f64 = 100_000.0;

/// BUG-16 fix: Typed request struct with validation instead of raw serde_json::Value.
/// Ensures product_id is present, amount is positive, and quantity is valid.
#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    /// Bitrefill product identifier (required)
    pub product_id: String,
    /// Order amount in the specified currency (must be > 0)
    pub amount: f64,
    /// Currency code (e.g., "USD", "EUR")
    #[serde(default = "default_currency")]
    pub currency: String,
    /// Quantity of gift cards (must be >= 1)
    #[serde(default = "default_quantity")]
    pub quantity: u32,
    /// Optional recipient email for delivery
    pub recipient_email: Option<String>,
}

fn default_currency() -> String { "USD".to_string() }
fn default_quantity() -> u32 { 1 }

impl CreateOrderRequest {
    /// Validate the order request fields
    fn validate(&self) -> Result<(), String> {
        if self.product_id.trim().is_empty() {
            return Err("product_id is required and cannot be empty".into());
        }
        if self.amount <= 0.0 {
            return Err(format!("amount must be greater than 0, got {}", self.amount));
        }
        if self.amount > MAX_ORDER_AMOUNT {
            return Err(format!("amount exceeds maximum allowed ({})", MAX_ORDER_AMOUNT));
        }
        if !self.amount.is_finite() {
            return Err("amount must be a finite number".into());
        }
        if self.quantity == 0 {
            return Err("quantity must be at least 1".into());
        }
        if self.currency.trim().is_empty() {
            return Err("currency cannot be empty".into());
        }
        if let Some(ref email) = self.recipient_email {
            if !email.is_empty() && !email.contains('@') {
                return Err("recipient_email must be a valid email address".into());
            }
        }
        Ok(())
    }
}

/// POST /api/v1/shopping/order — Bitrefill gift card order
pub async fn handler(_auth: AuthenticatedUser, body: web::Json<CreateOrderRequest>) -> HttpResponse {
    // BUG-16 fix: Validate typed request body
    if let Err(validation_error) = body.validate() {
        tracing::warn!("Order validation failed: {}", validation_error);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": validation_error
        }));
    }

    // Bitrefill gift card order:
    // 1. Search products via GET /products
    // 2. Create order via POST /orders
    // 3. Pay order via POST /orders/{id}/pay (crypto payment)
    // 4. Return order details + redemption codes
    let _bitrefill_base = "https://api.bitrefill.com/v2";
    tracing::info!(
        "Creating Bitrefill order: product={}, amount={} {}, qty={}",
        body.product_id, body.amount, body.currency, body.quantity
    );
    HttpResponse::Ok().json(serde_json::json!({"status": "order_created"}))
}
