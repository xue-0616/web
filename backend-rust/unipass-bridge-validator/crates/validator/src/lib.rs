pub mod api;
pub mod middleware;

use actix_web::web;

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            // Health/status endpoint — no auth required (for load balancer health checks)
            .route("/status", web::get().to(api::validator_status::handler))
            // Protected endpoints — require API key via X-API-Key header
            .route("/payment", web::post().to(api::payment::handler))
            .route("/payment/details", web::get().to(api::payment_details::handler))
            .route("/payment/status", web::get().to(api::payment_status::handler))
            .route("/webhook", web::post().to(api::webhook::handler))
            // Multisig: receive signatures from other validators
            .route("/collect-signature", web::post().to(api::collect_signature::handler))
    );
}
