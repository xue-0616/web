pub mod op_key;
pub mod status;
pub mod trading_swap;

use actix_web::web;

/// Configure authenticated API routes.
/// NOTE: /status is registered outside this scope (public, no auth) in main.rs.
/// This function is called inside the `/api/v1` scope that already has ApiKeyAuth middleware.
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg
        .service(
            web::scope("/op-key")
                .route("/create", web::post().to(op_key::create_op_key::handler))
                .route("/list", web::get().to(op_key::get_op_keys::handler))
        )
        .service(
            web::scope("/trading")
                .route("/swap", web::post().to(trading_swap::swap::handler))
                .route("/cancel", web::post().to(trading_swap::cancel_tx::handler))
        );
}
