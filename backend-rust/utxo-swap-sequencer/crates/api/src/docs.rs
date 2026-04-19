use utoipa::OpenApi;
use utoipa_redoc::{Redoc, Servable};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "UTXOSwap Sequencer API",
        version = "1.0.0",
        description = "CKB DEX Intent-based AMM Sequencer"
    ),
    paths(),
    components(schemas())
)]
pub struct ApiDoc;

pub fn redoc_handler() -> impl actix_web::dev::HttpServiceFactory {
    Redoc::with_url("/docs", ApiDoc::openapi())
}
