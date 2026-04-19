pub mod api;

use actix_web::web;

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .route("/chain-id", web::get().to(api::chain_id::handler))
            .route("/meta-nonce", web::get().to(api::meta_nonce::handler))
            .route("/nonce", web::get().to(api::nonce::handler))
            .route("/receipt", web::get().to(api::receipt::handler))
            .route("/simulate", web::post().to(api::simulate::handler))
            .route("/submitters", web::get().to(api::submitters::handler))
            .route("/transactions", web::post().to(api::transactions::handler))
    );
}
