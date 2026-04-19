pub mod configurations;
pub mod intents;
pub mod pools;
pub mod status;

use actix_web::web;

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .route("/status", web::get().to(status::handler))
            .route("/configurations", web::get().to(configurations::handler))
            .service(
                web::scope("/intents")
                    .route("/submit", web::post().to(intents::submit::handler))
                    .route("/create-pool", web::post().to(intents::create_pool_intent::handler))
                    .route("/submit-create-pool", web::post().to(intents::submit_create_pool_intent::handler))
                    .route("/status", web::get().to(intents::intent::get_status))
            )
            .service(
                web::scope("/pools")
                    .route("", web::get().to(pools::list::handler))
            )
    );
}
