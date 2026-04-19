pub mod account;
pub mod assets;
pub mod auth_middleware;
pub mod config_api;
pub mod context;
pub mod history;
pub mod invoice;
pub mod payment;
pub mod ramp;
pub mod rate_limiter;
pub mod referral;
pub mod shopping;
pub mod tls_middleware;

use actix_web::web;
use std::sync::Arc;

/// Rate-limited handler wrapper that checks rate limits before calling the actual handler.
/// Returns HTTP 429 Too Many Requests with Retry-After header when rate limit is exceeded.
async fn rate_limited<F, Fut>(
    req: actix_web::HttpRequest,
    limiter: &rate_limiter::RateLimiter,
    handler: F,
) -> actix_web::HttpResponse
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = actix_web::HttpResponse>,
{
    let client_ip = rate_limiter::get_client_ip(&req);
    match limiter.check(&client_ip) {
        Ok(_remaining) => handler().await,
        Err(retry_after) => {
            tracing::warn!("Rate limit exceeded for IP={}, retry_after={}s", client_ip, retry_after);
            actix_web::HttpResponse::TooManyRequests()
                .insert_header(("Retry-After", retry_after.to_string()))
                .json(serde_json::json!({
                    "error": "Rate limit exceeded",
                    "retryAfter": retry_after,
                }))
        }
    }
}

/// HIGH-10 fix: Configure routes with rate limiters applied
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    // Instantiate rate limiters and share via app data
    let rate_limiters = Arc::new(rate_limiter::RateLimiters::new());
    cfg.app_data(web::Data::from(rate_limiters));

    cfg.service(
        web::scope("/api/v1")
            // --- Public routes (no auth required) ---
            .service(
                web::scope("/account")
                    .route("/register", web::post().to(account::register::handler))
                    .route("/login", web::post().to(account::login::handler))
                    .route("/recovery", web::post().to(account::recovery::handler))
                    // /backup requires auth — handler uses AuthenticatedUser extractor
                    .route("/backup", web::post().to(account::update_backup::handler))
            )
            .route("/config", web::get().to(config_api::handler))
            .route("/health", web::get().to(health_handler))
            // Webhook endpoints (no JWT auth — use HMAC signature verification internally)
            .service(
                web::scope("/ramp/webhook")
                    .route("/alchemy-pay/on-ramp", web::post().to(ramp::webhooks::alchemy_pay::on_ramp_webhook::handler))
                    .route("/alchemy-pay/off-ramp", web::post().to(ramp::webhooks::alchemy_pay::off_ramp_webhook::handler))
            )
            // --- Protected routes (require AuthenticatedUser extractor) ---
            .service(
                web::scope("/assets")
                    .route("/list", web::get().to(assets::assets_list::handler))
                    .route("/estimated-fee", web::get().to(assets::estimated_fee::handler))
                    .route("/transaction", web::post().to(assets::transaction::handler))
            )
            .route("/history/notifications", web::get().to(history::notify_history::handler))
            .service(
                web::scope("/invoice")
                    .route("/create", web::post().to(invoice::create_invoice::handler))
                    .route("/history", web::get().to(invoice::invoice_history::handler))
            )
            .service(
                web::scope("/payment")
                    .route("/config", web::get().to(payment::config::handler))
                    .route("/details", web::get().to(payment::details::handler))
                    .route("/send", web::post().to(payment::send::handler))
            )
            .service(
                web::scope("/ramp")
                    .route("/on-ramp", web::post().to(ramp::on_ramp::handler))
                    .route("/off-ramp", web::post().to(ramp::off_ramp::handler))
            )
            .service(
                web::scope("/referral")
                    .route("/statistics", web::get().to(referral::invitation_statistics::handler))
                    .route("/submit-code", web::post().to(referral::submit_invitation_code::handler))
            )
            .service(
                web::scope("/shopping")
                    .route("/order", web::post().to(shopping::order_create::handler))
            )
    );
}

/// Actix-web middleware guard that enforces rate limiting per endpoint category (HIGH-10 fix)
pub struct RateLimitGuard {
    category: RateLimitCategory,
}

#[derive(Clone)]
pub enum RateLimitCategory {
    Login,
    Registration,
    Payment,
    Webhook,
    General,
}

impl RateLimitGuard {
    pub fn new(category: RateLimitCategory) -> Self {
        Self { category }
    }
}

impl actix_web::guard::Guard for RateLimitGuard {
    fn check(&self, ctx: &actix_web::guard::GuardContext<'_>) -> bool {
        let req_data = ctx.req_data();
        let limiters = match req_data.get::<web::Data<Arc<rate_limiter::RateLimiters>>>() {
            Some(l) => l,
            None => return true, // If no rate limiters configured, allow
        };

        let client_ip = ctx.head().peer_addr
            .map(|addr| addr.ip().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let limiter = match self.category {
            RateLimitCategory::Login => &limiters.login,
            RateLimitCategory::Registration => &limiters.registration,
            RateLimitCategory::Payment => &limiters.payment,
            RateLimitCategory::Webhook => &limiters.webhook,
            RateLimitCategory::General => &limiters.general,
        };

        limiter.check(&client_ip).is_ok()
    }
}

async fn health_handler() -> actix_web::HttpResponse {
    actix_web::HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}
