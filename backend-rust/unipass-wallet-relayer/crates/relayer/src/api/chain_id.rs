use actix_web::{web, HttpResponse};
use api::context::RelayerContext;

pub async fn handler(_ctx: web::Data<RelayerContext>) -> HttpResponse {
    // `_ctx` reserved for future per-deployment chain-id allow-lists
    // (today the list is compile-time constant). Underscore so the
    // Actix extractor signature stays stable while the body doesn't
    // read it.
    // Return supported chain IDs
    HttpResponse::Ok().json(serde_json::json!({
        "chainIds": [42161, 137, 56, 1]  // Arbitrum, Polygon, BSC, Ethereum
    }))
}
