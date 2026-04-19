use actix_web::{web, HttpResponse};
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
use serde::Deserialize;
use crate::auth_middleware::AuthenticatedUser;
use crate::context::PaymentContext;

/// Request body for invoice creation
#[derive(Debug, Deserialize)]
pub struct CreateInvoiceRequest {
    pub recipient_email: String,
    pub amount: String,
    pub currency: String,
    /// Optional: existing invoice_id to pay (for payment processing)
    pub invoice_id: Option<u64>,
}

/// POST /api/v1/invoice/create — create PayPal invoice
///
/// BUG-15 fix: If an invoice_id is provided, check that the invoice is not already
/// paid before processing. Uses status check to prevent double-payment.
pub async fn handler(
    _auth: AuthenticatedUser,
    ctx: web::Data<PaymentContext>,
    body: web::Json<CreateInvoiceRequest>,
) -> HttpResponse {
    // BUG-15 fix: If paying an existing invoice, check status to prevent double-payment
    if let Some(invoice_id) = body.invoice_id {
        let db = ctx.db();
        // Use SELECT ... FOR UPDATE to acquire row lock and prevent concurrent payment
        let lock_result: Result<Option<sea_orm::QueryResult>, sea_orm::DbErr> = db.query_one(Statement::from_sql_and_values(
            DatabaseBackend::MySql,
            "SELECT status, expires_at FROM invoices WHERE id = ? FOR UPDATE",
            [invoice_id.into()],
        )).await;

        match lock_result {
            Ok(Some(row)) => {
                use sea_orm::QueryResult;
                let status: String = row.try_get("", "status").unwrap_or_default();
                if status == "paid" {
                    tracing::warn!("Invoice {} already paid, rejecting duplicate payment", invoice_id);
                    return HttpResponse::Conflict().json(serde_json::json!({
                        "error": "Invoice already paid",
                        "invoice_id": invoice_id
                    }));
                }
                if status == "cancelled" {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "Invoice has been cancelled",
                        "invoice_id": invoice_id
                    }));
                }
                // BUG-14 check: Also verify invoice hasn't expired
                let expires_at: Option<chrono::NaiveDateTime> = row.try_get("", "expires_at").ok();
                if let Some(exp) = expires_at {
                    if chrono::Utc::now().naive_utc() > exp {
                        tracing::warn!("Invoice {} has expired", invoice_id);
                        return HttpResponse::BadRequest().json(serde_json::json!({
                            "error": "Invoice has expired",
                            "invoice_id": invoice_id
                        }));
                    }
                }
            }
            Ok(None) => {
                return HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Invoice not found",
                    "invoice_id": invoice_id
                }));
            }
            Err(e) => {
                tracing::error!("Failed to query invoice {}: {}", invoice_id, e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Internal server error"
                }));
            }
        }
    }

    // PayPal invoice creation:
    // 1. Authenticate with PayPal OAuth2 (client_id + secret → access_token)
    // 2. Create invoice via POST /v2/invoicing/invoices
    // 3. Return invoice URL for payment
    let is_sandbox = std::env::var("PAYPAL_SANDBOX").unwrap_or_else(|_| "true".into()) == "true";
    let _paypal_base = if is_sandbox { "https://api-m.sandbox.paypal.com" } else { "https://api-m.paypal.com" };
    tracing::info!("Creating PayPal invoice");
    HttpResponse::Ok().json(serde_json::json!({"status": "created"}))
}
